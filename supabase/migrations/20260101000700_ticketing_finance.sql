-- =============================================================================
-- PersEventos — Fase 2: Módulo Financeiro e Ingressos
--   * ticket_types (lotes)
--   * orders (pedidos)
--   * tickets (ingressos individuais com qr_code_hash único)
-- Todas isoladas por tenant_id + RLS espelhando 20260101000600.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums de pagamento
-- ---------------------------------------------------------------------------
create type public.order_status as enum ('pending', 'paid', 'canceled', 'refunded');
create type public.payment_method as enum ('pix', 'credit_card');

-- ---------------------------------------------------------------------------
-- set_tenant_id: contextos sem usuário (service role / SQL direto) confiam no
-- tenant informado. Antes disso, o webhook server-side não conseguiria inserir
-- os ingressos com o tenant do pedido (auth.uid() é nulo nesses contextos).
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
-- ticket_types (lotes de ingressos) — gerido pelo Admin do Estabelecimento.
-- ---------------------------------------------------------------------------
create table public.ticket_types (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references public.estabelecimentos (id) on delete cascade,
  event_id       uuid not null references public.eventos (id) on delete cascade,
  name           text not null,
  price          numeric(10,2) not null default 0 check (price >= 0),
  quantity_total integer not null check (quantity_total >= 0),
  quantity_sold  integer not null default 0 check (quantity_sold >= 0),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint ticket_types_sold_le_total check (quantity_sold <= quantity_total)
);

create index if not exists ticket_types_event_idx  on public.ticket_types (event_id);
create index if not exists ticket_types_tenant_idx on public.ticket_types (tenant_id);
create index if not exists ticket_types_active_idx on public.ticket_types (event_id, is_active);

-- ---------------------------------------------------------------------------
-- orders (pedidos) — checkout do cliente (PENDING) até o webhook (PAID).
-- ticket_type_id/quantity são necessários para o webhook gerar os ingressos.
-- ---------------------------------------------------------------------------
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid references public.estabelecimentos (id) on delete cascade,
  customer_id     uuid not null references public.pessoas (id) on delete restrict,
  event_id        uuid not null references public.eventos (id) on delete cascade,
  ticket_type_id  uuid not null references public.ticket_types (id) on delete restrict,
  quantity        integer not null default 1 check (quantity > 0),
  total_amount    numeric(10,2) not null default 0 check (total_amount >= 0),
  status          public.order_status not null default 'pending',
  payment_method  public.payment_method not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists orders_event_idx    on public.orders (event_id);
create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists orders_tenant_idx   on public.orders (tenant_id);
create index if not exists orders_status_idx   on public.orders (event_id, status);

-- ---------------------------------------------------------------------------
-- tickets (ingressos individuais) — gerados na confirmação do pagamento.
-- ---------------------------------------------------------------------------
create table public.tickets (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid references public.estabelecimentos (id) on delete cascade,
  order_id         uuid not null references public.orders (id) on delete cascade,
  ticket_type_id   uuid not null references public.ticket_types (id) on delete cascade,
  customer_id      uuid not null references public.pessoas (id) on delete cascade,
  qr_code_hash     text not null unique,
  is_checked_in    boolean not null default false,
  checked_in_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists tickets_order_idx       on public.tickets (order_id);
create index if not exists tickets_ticket_type_idx on public.tickets (ticket_type_id);
create index if not exists tickets_customer_idx    on public.tickets (customer_id);
create index if not exists tickets_tenant_idx      on public.tickets (tenant_id);
create index if not exists tickets_checked_idx     on public.tickets (tenant_id, is_checked_in);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at + carimbo de tenant (mesmo padrão de 00500)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['ticket_types', 'orders', 'tickets']
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      t, t
    );

    execute format('drop trigger if exists %I_set_tenant_id on public.%I', t, t);
    execute format(
      'create trigger %I_set_tenant_id before insert or update on public.%I
         for each row execute function public.set_tenant_id()',
      t, t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ticket_types enable row level security;

drop policy if exists "ticket_types_select" on public.ticket_types;
drop policy if exists "ticket_types_insert" on public.ticket_types;
drop policy if exists "ticket_types_update" on public.ticket_types;
drop policy if exists "ticket_types_delete" on public.ticket_types;

create policy "ticket_types_select" on public.ticket_types
  for select to authenticated
  using (public.same_tenant(tenant_id));

create policy "ticket_types_insert" on public.ticket_types
  for insert to authenticated
  with check (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

create policy "ticket_types_update" on public.ticket_types
  for update to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()))
  with check (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

create policy "ticket_types_delete" on public.ticket_types
  for delete to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

alter table public.orders enable row level security;

drop policy if exists "orders_select" on public.orders;
drop policy if exists "orders_insert" on public.orders;
drop policy if exists "orders_update" on public.orders;
drop policy if exists "orders_delete" on public.orders;

create policy "orders_select" on public.orders
  for select to authenticated
  using (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_staff_or_admin() or customer_id = public.current_pessoa_id()))
  );

create policy "orders_insert" on public.orders
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_staff_or_admin() or customer_id = public.current_pessoa_id()))
  );

create policy "orders_update" on public.orders
  for update to authenticated
  using (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_staff_or_admin() or customer_id = public.current_pessoa_id()))
  )
  with check (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_staff_or_admin() or customer_id = public.current_pessoa_id()))
  );

create policy "orders_delete" on public.orders
  for delete to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

alter table public.tickets enable row level security;

drop policy if exists "tickets_select" on public.tickets;
drop policy if exists "tickets_insert" on public.tickets;
drop policy if exists "tickets_update" on public.tickets;
drop policy if exists "tickets_delete" on public.tickets;

create policy "tickets_select" on public.tickets
  for select to authenticated
  using (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_staff_or_admin() or customer_id = public.current_pessoa_id()))
  );

create policy "tickets_insert" on public.tickets
  for insert to authenticated
  with check (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_staff_or_admin()));

create policy "tickets_update" on public.tickets
  for update to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_staff_or_admin()))
  with check (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_staff_or_admin()));

create policy "tickets_delete" on public.tickets
  for delete to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

-- ---------------------------------------------------------------------------
-- Grants (o 00600 já cobre via default privileges; explícito por garantia)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.ticket_types, public.orders, public.tickets to authenticated;
grant all on public.ticket_types, public.orders, public.tickets to service_role;
