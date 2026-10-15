-- =============================================================================
-- PersEventos — RLS, funções auxiliares e criação de perfil
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Cria um perfil automaticamente para cada novo usuário do Auth.
-- O primeiro usuário do sistema vira `admin`; os demais entram como `recepcao`.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_papel public.papel;
begin
  if not exists (select 1 from public.profiles) then
    v_papel := 'admin';
  else
    v_papel := 'recepcao';
  end if;

  insert into public.profiles (id, nome, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.email),
    v_papel
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers de papel. SECURITY DEFINER para ler profiles sem recursão de RLS.
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

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_papel() = 'admin', false);
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_papel() in ('admin', 'staff'), false);
$$;

revoke all on function public.current_papel() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_staff_or_admin() from public;
grant execute on function public.current_papel() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff_or_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Impede que um usuário não-admin altere o próprio papel.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_papel_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.papel is distinct from old.papel and not public.is_admin() then
    raise exception 'Apenas administradores podem alterar o papel de um usuário';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_papel_change
  before update on public.profiles
  for each row execute function public.prevent_papel_change();

-- =============================================================================
-- Políticas de RLS
-- =============================================================================
alter table public.profiles          enable row level security;
alter table public.pessoas           enable row level security;
alter table public.menores           enable row level security;
alter table public.eventos           enable row level security;
alter table public.inscricoes        enable row level security;
alter table public.documentos        enable row level security;
alter table public.termos            enable row level security;
alter table public.log_acesso_dados  enable row level security;

-- --------------------------------------------------------------------------
-- profiles
-- --------------------------------------------------------------------------
create policy "profiles_select" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or public.is_admin());

create policy "profiles_update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

-- --------------------------------------------------------------------------
-- pessoas  (leitura: todos; escrita: staff/admin; exclusão: admin)
-- --------------------------------------------------------------------------
create policy "pessoas_select" on public.pessoas
  for select to authenticated using (true);

create policy "pessoas_insert" on public.pessoas
  for insert to authenticated with check (public.is_staff_or_admin());

create policy "pessoas_update" on public.pessoas
  for update to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

create policy "pessoas_delete" on public.pessoas
  for delete to authenticated using (public.is_admin());

-- --------------------------------------------------------------------------
-- menores
-- --------------------------------------------------------------------------
create policy "menores_select" on public.menores
  for select to authenticated using (true);

create policy "menores_insert" on public.menores
  for insert to authenticated with check (public.is_staff_or_admin());

create policy "menores_update" on public.menores
  for update to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

create policy "menores_delete" on public.menores
  for delete to authenticated using (public.is_admin());

-- --------------------------------------------------------------------------
-- eventos
-- --------------------------------------------------------------------------
create policy "eventos_select" on public.eventos
  for select to authenticated using (true);

create policy "eventos_insert" on public.eventos
  for insert to authenticated with check (public.is_staff_or_admin());

create policy "eventos_update" on public.eventos
  for update to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

create policy "eventos_delete" on public.eventos
  for delete to authenticated using (public.is_admin());

-- --------------------------------------------------------------------------
-- inscricoes (update liberado: recepção precisa fazer check-in/out)
-- --------------------------------------------------------------------------
create policy "inscricoes_select" on public.inscricoes
  for select to authenticated using (true);

create policy "inscricoes_insert" on public.inscricoes
  for insert to authenticated with check (public.is_staff_or_admin());

create policy "inscricoes_update" on public.inscricoes
  for update to authenticated using (true) with check (true);

create policy "inscricoes_delete" on public.inscricoes
  for delete to authenticated using (public.is_admin());

-- --------------------------------------------------------------------------
-- documentos
-- --------------------------------------------------------------------------
create policy "documentos_select" on public.documentos
  for select to authenticated using (true);

create policy "documentos_insert" on public.documentos
  for insert to authenticated with check (public.is_staff_or_admin());

create policy "documentos_update" on public.documentos
  for update to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

create policy "documentos_delete" on public.documentos
  for delete to authenticated using (public.is_admin());

-- --------------------------------------------------------------------------
-- termos (recepção assina no ato do check-in)
-- --------------------------------------------------------------------------
create policy "termos_select" on public.termos
  for select to authenticated using (true);

create policy "termos_insert" on public.termos
  for insert to authenticated with check (true);

create policy "termos_update" on public.termos
  for update to authenticated using (true) with check (true);

create policy "termos_delete" on public.termos
  for delete to authenticated using (public.is_admin());

-- --------------------------------------------------------------------------
-- log_acesso_dados (grava o próprio acesso; leitura só admin)
-- --------------------------------------------------------------------------
create policy "log_insert" on public.log_acesso_dados
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "log_select" on public.log_acesso_dados
  for select to authenticated using (public.is_admin());

-- =============================================================================
-- Privilégios de tabela (o RLS continua sendo o portão de acesso).
-- No Supabase Cloud isto já é padrão; explicitamos para portabilidade.
-- =============================================================================
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
