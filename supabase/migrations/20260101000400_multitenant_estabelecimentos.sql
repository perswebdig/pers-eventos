-- =============================================================================
-- PersEventos — Multitenant: estabelecimentos (tenants) + contexto do perfil
-- =============================================================================

-- ---------------------------------------------------------------------------
-- estabelecimentos (tenants). Tabela raiz: NÃO possui tenant_id.
-- ---------------------------------------------------------------------------
create table if not exists public.estabelecimentos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  slug       text not null unique,
  cnpj       text unique,
  email      text,
  telefone   text,
  endereco   text,
  cidade     text,
  estado     text,
  logo_url   text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists estabelecimentos_slug_idx  on public.estabelecimentos (slug);
create index if not exists estabelecimentos_ativo_idx on public.estabelecimentos (ativo);

drop trigger if exists estabelecimentos_set_updated_at on public.estabelecimentos;
create trigger estabelecimentos_set_updated_at
  before update on public.estabelecimentos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles ganha vínculo com o tenant, e-mail denormalizado e status.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists tenant_id uuid references public.estabelecimentos (id) on delete restrict,
  add column if not exists email     text,
  add column if not exists pessoa_id uuid references public.pessoas (id) on delete set null,
  add column if not exists ativo     boolean not null default true;

create index if not exists profiles_tenant_idx on public.profiles (tenant_id);
create index if not exists profiles_email_idx  on public.profiles (lower(email));
create index if not exists profiles_pessoa_idx on public.profiles (pessoa_id);

-- ---------------------------------------------------------------------------
-- Helpers de contexto. SECURITY DEFINER para ler profiles sem recursão de RLS.
-- ---------------------------------------------------------------------------
create or replace function public.current_papel()
returns public.papel
language sql
stable
security definer
set search_path = public
as $$
  select papel from public.profiles where id = (select auth.uid());
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = (select auth.uid());
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_papel() = 'super_admin', false);
$$;

-- Admin do estabelecimento (inclui o papel legado `admin`).
create or replace function public.is_tenant_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_papel() in ('tenant_admin', 'admin'), false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_papel() in ('recepcao', 'staff'), false);
$$;

-- Staff do tenant ou admin (usado para escrita operacional).
create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_tenant_admin() or public.is_staff();
$$;

-- Alias mantido para compatibilidade (políticas de Storage antigas usam is_admin).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_tenant_admin();
$$;

create or replace function public.is_cliente()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_papel() = 'cliente', false);
$$;

-- Pessoa vinculada ao usuário logado (para o autoatendimento do cliente).
create or replace function public.current_pessoa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pessoa_id from public.profiles where id = (select auth.uid());
$$;

-- O usuário pertence ao tenant informado (ou é super admin)?
create or replace function public.same_tenant(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or (tid is not null and tid = public.current_tenant_id());
$$;

revoke all on function public.current_papel()      from public;
revoke all on function public.current_tenant_id()  from public;
revoke all on function public.is_super_admin()     from public;
revoke all on function public.is_tenant_admin()    from public;
revoke all on function public.is_staff()           from public;
revoke all on function public.is_staff_or_admin()  from public;
revoke all on function public.is_cliente()         from public;
revoke all on function public.current_pessoa_id()  from public;
revoke all on function public.same_tenant(uuid)    from public;

grant execute on function public.current_papel()      to authenticated;
grant execute on function public.current_tenant_id()  to authenticated;
grant execute on function public.is_super_admin()     to authenticated;
grant execute on function public.is_tenant_admin()    to authenticated;
grant execute on function public.is_staff()           to authenticated;
grant execute on function public.is_staff_or_admin()  to authenticated;
grant execute on function public.is_cliente()         to authenticated;
grant execute on function public.current_pessoa_id()  to authenticated;
grant execute on function public.same_tenant(uuid)    to authenticated;

-- ---------------------------------------------------------------------------
-- Trigger genérica: carimba tenant_id a partir do perfil do usuário logado e
-- impede que um tenant grave em outro. Super admin pode definir qualquer um.
-- ---------------------------------------------------------------------------
create or replace function public.set_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() then
    -- Super admin grava em nome de qualquer tenant (deve informar tenant_id).
    return new;
  end if;

  -- Usuário comum: o tenant é sempre o do próprio perfil, ignorando o cliente.
  if new.tenant_id is null then
    new.tenant_id := public.current_tenant_id();
  end if;

  if new.tenant_id is distinct from public.current_tenant_id() then
    raise exception 'Operação bloqueada: tenant_id (%) difere do tenant do usuário (%)',
      new.tenant_id, public.current_tenant_id()
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Criação de perfil ao registrar usuário.
--   * primeiro usuário do sistema  -> super_admin (dono da PersEventos)
--   * demais autoatendimentos      -> cliente, vinculado ao tenant do convite
--     (raw_user_meta_data->>'tenant_id' / 'estabelecimento_id')
--   * papéis administrativos são atribuídos depois pelo Super Admin (service role)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_papel     public.papel;
  v_tenant_id uuid;
  v_nome      text;
begin
  v_nome := coalesce(new.raw_user_meta_data ->> 'nome', new.email);

  if not exists (select 1 from public.profiles) then
    v_papel := 'super_admin';
    v_tenant_id := null;
  else
    v_papel := 'cliente';
    v_tenant_id := nullif(coalesce(
      new.raw_user_meta_data ->> 'tenant_id',
      new.raw_user_meta_data ->> 'estabelecimento_id'
    ), '')::uuid;
  end if;

  insert into public.profiles (id, nome, email, papel, tenant_id)
  values (new.id, v_nome, new.email, v_papel, v_tenant_id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Impede alteração de papel/tenant por quem não é admin.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_papel_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if new.papel is distinct from old.papel then
    raise exception 'Apenas administradores podem alterar o papel de um usuário';
  end if;

  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'Apenas o Super Admin pode mover um usuário entre estabelecimentos';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_papel_change on public.profiles;
create trigger profiles_prevent_papel_change
  before update on public.profiles
  for each row execute function public.prevent_papel_change();
