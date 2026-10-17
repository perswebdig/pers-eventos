-- =============================================================================
-- PersEventos — Estabelecimentos ⇄ Pessoas
--   * pessoa_estabelecimentos: base de clientes de cada estabelecimento. Um
--     cliente pode pertencer a vários estabelecimentos (vínculo N:N), mas no
--     portal navega em UM por vez (profiles.tenant_id = estabelecimento ativo).
--   * Auto-vínculo: toda pessoa criada, pedido ou inscrição vincula a pessoa
--     ao estabelecimento correspondente.
--   * Visibilidade: cliente enxerga pedidos, ingressos e inscrições de todos
--     os estabelecimentos em que tem histórico (carteira multi-estabelecimento).
--   * RPC selecionar_estabelecimento: cliente escolhe/troca o estabelecimento
--     ativo no portal (valida que está ativo).
--   * RPC vincular_pessoa: equipe do estabelecimento adiciona uma pessoa que
--     já existe na plataforma (busca por CPF ou e-mail).
--   * set_tenant_id v2: em UPDATE, tenant é imutável (evita "roubo" de
--     registros entre estabelecimentos); em INSERT segue igual.
--   * prevent_papel_change v2: service_role livre; cliente pode trocar o
--     próprio tenant (seleção de estabelecimento); papel segue imutável.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Vínculos pessoa ⇄ estabelecimento
-- ---------------------------------------------------------------------------
create table if not exists public.pessoa_estabelecimentos (
  id         uuid primary key default gen_random_uuid(),
  pessoa_id  uuid not null references public.pessoas (id) on delete cascade,
  tenant_id  uuid not null references public.estabelecimentos (id) on delete cascade,
  origem     text not null default 'cadastro'
             check (origem in ('cadastro', 'compra', 'inscricao', 'cliente', 'estabelecimento')),
  created_at timestamptz not null default now(),
  unique (pessoa_id, tenant_id)
);

create index if not exists pessoa_estabelecimentos_pessoa_idx
  on public.pessoa_estabelecimentos (pessoa_id);
create index if not exists pessoa_estabelecimentos_tenant_idx
  on public.pessoa_estabelecimentos (tenant_id);

alter table public.pessoa_estabelecimentos enable row level security;

drop policy if exists "pessoa_estabelecimentos_select" on public.pessoa_estabelecimentos;
drop policy if exists "pessoa_estabelecimentos_insert" on public.pessoa_estabelecimentos;
drop policy if exists "pessoa_estabelecimentos_delete" on public.pessoa_estabelecimentos;

create policy "pessoa_estabelecimentos_select" on public.pessoa_estabelecimentos
  for select to authenticated
  using (
    public.is_super_admin()
    or pessoa_id = public.current_pessoa_id()
    or (tenant_id = public.current_tenant_id() and public.is_staff_or_admin())
  );

create policy "pessoa_estabelecimentos_insert" on public.pessoa_estabelecimentos
  for insert to authenticated
  with check (
    public.is_super_admin()
    or pessoa_id = public.current_pessoa_id()
    or (tenant_id = public.current_tenant_id() and public.is_staff_or_admin())
  );

create policy "pessoa_estabelecimentos_delete" on public.pessoa_estabelecimentos
  for delete to authenticated
  using (
    public.is_super_admin()
    or (tenant_id = public.current_tenant_id() and public.is_staff_or_admin())
  );

grant select, insert, delete on public.pessoa_estabelecimentos to authenticated;
grant all on public.pessoa_estabelecimentos to service_role;

-- Base de dados atual: pessoas já existentes entram na base do próprio tenant.
insert into public.pessoa_estabelecimentos (pessoa_id, tenant_id, origem)
select id, tenant_id, 'cadastro'
from public.pessoas
where tenant_id is not null
on conflict (pessoa_id, tenant_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Auto-vínculo em pessoas / orders / inscricoes
-- ---------------------------------------------------------------------------
create or replace function public.auto_vincular_pessoa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pessoa uuid;
  v_tenant uuid;
  v_origem text;
begin
  if tg_table_name = 'pessoas' then
    v_pessoa := new.id;
    v_tenant := new.tenant_id;
    v_origem := 'cadastro';
  elsif tg_table_name = 'orders' then
    v_pessoa := new.customer_id;
    v_tenant := new.tenant_id;
    v_origem := 'compra';
  elsif tg_table_name = 'inscricoes' then
    v_pessoa := new.pessoa_id;
    v_tenant := new.tenant_id;
    v_origem := 'inscricao';
  end if;

  if v_pessoa is not null and v_tenant is not null then
    insert into public.pessoa_estabelecimentos (pessoa_id, tenant_id, origem)
    values (v_pessoa, v_tenant, v_origem)
    on conflict (pessoa_id, tenant_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists pessoas_auto_vincular on public.pessoas;
create trigger pessoas_auto_vincular
  after insert on public.pessoas
  for each row execute function public.auto_vincular_pessoa();

drop trigger if exists orders_auto_vincular on public.orders;
create trigger orders_auto_vincular
  after insert on public.orders
  for each row execute function public.auto_vincular_pessoa();

drop trigger if exists inscricoes_auto_vincular on public.inscricoes;
create trigger inscricoes_auto_vincular
  after insert on public.inscricoes
  for each row execute function public.auto_vincular_pessoa();

-- ---------------------------------------------------------------------------
-- 3) set_tenant_id v2 — INSERT carimba o tenant do usuário; UPDATE não permite
--    trocar o tenant de um registro (só super admin / service role).
-- ---------------------------------------------------------------------------
create or replace function public.set_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role / migrações / SQL direto: não há sessão de usuário.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.tenant_id is null then
      new.tenant_id := public.current_tenant_id();
    end if;

    if new.tenant_id is distinct from public.current_tenant_id() then
      raise exception 'Operação bloqueada: tenant_id (%) difere do tenant do usuário (%)',
        new.tenant_id, public.current_tenant_id()
        using errcode = '42501';
    end if;

    return new;
  end if;

  -- UPDATE: o tenant do registro é imutável para usuários comuns.
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'Operação bloqueada: não é permitido mover registros entre estabelecimentos.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) prevent_papel_change v2 — service_role livre; cliente pode trocar o
--    próprio tenant (escolher estabelecimento); papel continua imutável.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_papel_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.role()) = 'service_role' then
    return new;
  end if;

  if public.is_super_admin() then
    return new;
  end if;

  if new.papel is distinct from old.papel then
    raise exception 'Apenas administradores podem alterar o papel de um usuário';
  end if;

  if new.tenant_id is distinct from old.tenant_id then
    -- Cliente escolhe/troca o estabelecimento ativo pelo portal.
    if old.papel = 'cliente' then
      return new;
    end if;

    raise exception 'Apenas o Super Admin pode mover um usuário entre estabelecimentos';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) RLS — visibilidade entre estabelecimentos e carteira multi-estabelecimento
-- ---------------------------------------------------------------------------

-- Cliente pode listar estabelecimentos ativos (seletor do portal).
drop policy if exists "estabelecimentos_select" on public.estabelecimentos;
create policy "estabelecimentos_select" on public.estabelecimentos
  for select to authenticated
  using (
    public.is_super_admin()
    or id = public.current_tenant_id()
    or (ativo and public.is_cliente())
  );

-- pessoas: dono (self), equipe do próprio tenant e equipe dos tenants em que a
-- pessoa está vinculada.
drop policy if exists "pessoas_select" on public.pessoas;
create policy "pessoas_select" on public.pessoas
  for select to authenticated
  using (
    public.is_super_admin()
    or id = public.current_pessoa_id()
    or (public.is_staff_or_admin() and public.same_tenant(tenant_id))
    or (public.is_staff_or_admin() and exists (
         select 1 from public.pessoa_estabelecimentos pe
          where pe.pessoa_id = pessoas.id
            and pe.tenant_id = public.current_tenant_id()
       ))
  );

drop policy if exists "pessoas_update" on public.pessoas;
create policy "pessoas_update" on public.pessoas
  for update to authenticated
  using (
    public.is_super_admin()
    or id = public.current_pessoa_id()
    or (public.is_staff_or_admin() and (
         public.same_tenant(tenant_id)
         or exists (
           select 1 from public.pessoa_estabelecimentos pe
            where pe.pessoa_id = pessoas.id
              and pe.tenant_id = public.current_tenant_id()
         )
       ))
  )
  with check (
    public.is_super_admin()
    or id = public.current_pessoa_id()
    or (public.is_staff_or_admin() and (
         public.same_tenant(tenant_id)
         or exists (
           select 1 from public.pessoa_estabelecimentos pe
            where pe.pessoa_id = pessoas.id
              and pe.tenant_id = public.current_tenant_id()
         )
       ))
  );

-- menores: mesma regra da pessoa dona.
drop policy if exists "menores_select" on public.menores;
create policy "menores_select" on public.menores
  for select to authenticated
  using (
    public.is_super_admin()
    or pessoa_id = public.current_pessoa_id()
    or (public.is_staff_or_admin() and public.same_tenant(tenant_id))
    or (public.is_staff_or_admin() and exists (
         select 1 from public.pessoa_estabelecimentos pe
          where pe.pessoa_id = menores.pessoa_id
            and pe.tenant_id = public.current_tenant_id()
       ))
  );

drop policy if exists "menores_update" on public.menores;
create policy "menores_update" on public.menores
  for update to authenticated
  using (
    public.is_super_admin()
    or pessoa_id = public.current_pessoa_id()
    or (public.is_staff_or_admin() and (
         public.same_tenant(tenant_id)
         or exists (
           select 1 from public.pessoa_estabelecimentos pe
            where pe.pessoa_id = menores.pessoa_id
              and pe.tenant_id = public.current_tenant_id()
         )
       ))
  )
  with check (
    public.is_super_admin()
    or pessoa_id = public.current_pessoa_id()
    or (public.is_staff_or_admin() and (
         public.same_tenant(tenant_id)
         or exists (
           select 1 from public.pessoa_estabelecimentos pe
            where pe.pessoa_id = menores.pessoa_id
              and pe.tenant_id = public.current_tenant_id()
         )
       ))
  );

-- Cliente enxerga os próprios registros em qualquer estabelecimento (carteira
-- de ingressos e histórico continuam visíveis ao trocar de estabelecimento).
drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders
  for select to authenticated
  using (
    public.is_super_admin()
    or customer_id = public.current_pessoa_id()
    or (public.same_tenant(tenant_id) and public.is_staff_or_admin())
  );

drop policy if exists "orders_update" on public.orders;
create policy "orders_update" on public.orders
  for update to authenticated
  using (
    public.is_super_admin()
    or customer_id = public.current_pessoa_id()
    or (public.same_tenant(tenant_id) and public.is_staff_or_admin())
  )
  with check (
    public.is_super_admin()
    or customer_id = public.current_pessoa_id()
    or (public.same_tenant(tenant_id) and public.is_staff_or_admin())
  );

drop policy if exists "tickets_select" on public.tickets;
create policy "tickets_select" on public.tickets
  for select to authenticated
  using (
    public.is_super_admin()
    or customer_id = public.current_pessoa_id()
    or (public.same_tenant(tenant_id) and public.is_staff_or_admin())
  );

drop policy if exists "inscricoes_select" on public.inscricoes;
create policy "inscricoes_select" on public.inscricoes
  for select to authenticated
  using (
    public.is_super_admin()
    or pessoa_id = public.current_pessoa_id()
    or (public.same_tenant(tenant_id) and public.is_staff_or_admin())
  );

drop policy if exists "termos_select" on public.termos;
create policy "termos_select" on public.termos
  for select to authenticated
  using (
    public.is_super_admin()
    or pessoa_id = public.current_pessoa_id()
    or (public.same_tenant(tenant_id) and public.is_staff_or_admin())
  );

drop policy if exists "documentos_select" on public.documentos;
create policy "documentos_select" on public.documentos
  for select to authenticated
  using (
    public.is_super_admin()
    or pessoa_id = public.current_pessoa_id()
    or (public.same_tenant(tenant_id) and public.is_staff_or_admin())
  );

-- Histórico do cliente: evento, lote e espaço ligados a um pedido ou inscrição
-- continuam visíveis depois de trocar de estabelecimento (carteira completa).
drop policy if exists "eventos_select" on public.eventos;
create policy "eventos_select" on public.eventos
  for select to authenticated
  using (
    public.same_tenant(tenant_id)
    or exists (
      select 1 from public.orders o
       where o.event_id = eventos.id
         and o.customer_id = public.current_pessoa_id()
    )
    or exists (
      select 1 from public.inscricoes i
       where i.evento_id = eventos.id
         and i.pessoa_id = public.current_pessoa_id()
    )
  );

drop policy if exists "ticket_types_select" on public.ticket_types;
create policy "ticket_types_select" on public.ticket_types
  for select to authenticated
  using (
    public.same_tenant(tenant_id)
    or exists (
      select 1 from public.orders o
       where o.ticket_type_id = ticket_types.id
         and o.customer_id = public.current_pessoa_id()
    )
  );

drop policy if exists "espacos_select" on public.espacos;
create policy "espacos_select" on public.espacos
  for select to authenticated
  using (
    public.same_tenant(tenant_id)
    or exists (
      select 1 from public.orders o
       where o.espaco_id = espacos.id
         and o.customer_id = public.current_pessoa_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 6) RPC selecionar_estabelecimento — cliente escolhe/troca o ativo no portal.
-- ---------------------------------------------------------------------------
create or replace function public.selecionar_estabelecimento(p_tenant_id uuid)
returns public.estabelecimentos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estabelecimento public.estabelecimentos;
  v_pessoa uuid;
begin
  if not public.is_cliente() then
    raise exception 'Apenas clientes podem selecionar o estabelecimento.'
      using errcode = 'P0001';
  end if;

  select * into v_estabelecimento
  from public.estabelecimentos
  where id = p_tenant_id and ativo;

  if not found then
    raise exception 'Estabelecimento indisponível.' using errcode = 'P0002';
  end if;

  update public.profiles
     set tenant_id = p_tenant_id
   where id = (select auth.uid());

  -- Registra o vínculo com o estabelecimento escolhido (base de clientes).
  v_pessoa := public.current_pessoa_id();
  if v_pessoa is not null then
    insert into public.pessoa_estabelecimentos (pessoa_id, tenant_id, origem)
    values (v_pessoa, p_tenant_id, 'cliente')
    on conflict (pessoa_id, tenant_id) do nothing;
  end if;

  return v_estabelecimento;
end;
$$;

revoke all on function public.selecionar_estabelecimento(uuid) from public, anon;
grant execute on function public.selecionar_estabelecimento(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) RPC vincular_pessoa — equipe adiciona à base uma pessoa já existente
--    (busca por CPF ou e-mail).
-- ---------------------------------------------------------------------------
create or replace function public.vincular_pessoa(p_cpf text, p_email text)
returns public.pessoas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_pessoa public.pessoas;
  v_cpf    text;
  v_email  text;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Apenas a equipe do estabelecimento pode vincular pessoas.'
      using errcode = 'P0001';
  end if;

  v_tenant := public.current_tenant_id();
  if v_tenant is null then
    raise exception 'Usuário sem estabelecimento definido.' using errcode = 'P0001';
  end if;

  v_cpf := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  if v_cpf is null and v_email is null then
    raise exception 'Informe o CPF ou o e-mail da pessoa.' using errcode = '22023';
  end if;

  if v_cpf is not null then
    select * into v_pessoa from public.pessoas where cpf = v_cpf order by created_at limit 1;
  else
    select * into v_pessoa from public.pessoas
     where lower(email) = v_email order by created_at limit 1;
  end if;

  if not found then
    raise exception 'Nenhuma pessoa encontrada com esse CPF ou e-mail.'
      using errcode = 'P0002';
  end if;

  insert into public.pessoa_estabelecimentos (pessoa_id, tenant_id, origem)
  values (v_pessoa.id, v_tenant, 'estabelecimento')
  on conflict (pessoa_id, tenant_id) do nothing;

  return v_pessoa;
end;
$$;

revoke all on function public.vincular_pessoa(text, text) from public, anon;
grant execute on function public.vincular_pessoa(text, text) to authenticated;
