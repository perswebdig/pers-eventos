-- =============================================================================
-- PersEventos — Espaços com lugar marcado (setores + cadeiras)
--   * espacos: setor do evento com preço único (ex.: Plateia, Camarote)
--   * assentos: cadeiras geradas em grade (fileira A–Z × número), com estado
--     livre / reservado / vendido e reserva de 30 minutos por pedido
--   * Pedidos de lugar marcado usam orders.espaco_id (ticket_type_id nulo)
--   * tickets ganham espaco_id / assento_fileira / assento_numero
-- Fase A do módulo: gerador em grade + reserva obrigatória no checkout.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- espacos
-- ---------------------------------------------------------------------------
create table if not exists public.espacos (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid references public.estabelecimentos (id) on delete cascade,
  event_id              uuid not null references public.eventos (id) on delete cascade,
  nome                  text not null,
  price                 numeric(10,2) not null default 0 check (price >= 0),
  fileiras              integer not null check (fileiras between 1 and 26),
  cadeiras_por_fileira  integer not null check (cadeiras_por_fileira between 1 and 200),
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists espacos_event_idx  on public.espacos (event_id);
create index if not exists espacos_tenant_idx on public.espacos (tenant_id);
create index if not exists espacos_active_idx on public.espacos (event_id, is_active);

-- ---------------------------------------------------------------------------
-- assentos
-- ---------------------------------------------------------------------------
create table if not exists public.assentos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.estabelecimentos (id) on delete cascade,
  espaco_id     uuid not null references public.espacos (id) on delete cascade,
  fileira       text not null,
  numero        integer not null check (numero >= 1),
  status        text not null default 'livre' check (status in ('livre', 'reservado', 'vendido')),
  order_id      uuid references public.orders (id) on delete set null,
  reservado_ate timestamptz,
  ticket_id     uuid references public.tickets (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (espaco_id, fileira, numero)
);

create index if not exists assentos_espaco_status_idx on public.assentos (espaco_id, status);
create index if not exists assentos_order_idx         on public.assentos (order_id);
create index if not exists assentos_tenant_idx        on public.assentos (tenant_id);

-- ---------------------------------------------------------------------------
-- orders / tickets: suportam pedidos de lugar marcado
-- ---------------------------------------------------------------------------
alter table public.orders alter column ticket_type_id drop not null;
alter table public.orders add column if not exists espaco_id uuid references public.espacos (id) on delete restrict;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_target_chk') then
    alter table public.orders
      add constraint orders_target_chk
      check (ticket_type_id is not null or espaco_id is not null);
  end if;
end;
$$;

alter table public.tickets alter column ticket_type_id drop not null;
alter table public.tickets add column if not exists espaco_id uuid references public.espacos (id) on delete set null;
alter table public.tickets add column if not exists assento_fileira text;
alter table public.tickets add column if not exists assento_numero integer;

-- ---------------------------------------------------------------------------
-- Triggers: updated_at + carimbo de tenant (mesmo padrão de 00700)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['espacos', 'assentos']
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
alter table public.espacos  enable row level security;
alter table public.assentos enable row level security;

drop policy if exists "espacos_select" on public.espacos;
drop policy if exists "espacos_insert" on public.espacos;
drop policy if exists "espacos_update" on public.espacos;
drop policy if exists "espacos_delete" on public.espacos;

create policy "espacos_select" on public.espacos
  for select to authenticated
  using (public.same_tenant(tenant_id));

create policy "espacos_insert" on public.espacos
  for insert to authenticated
  with check (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

create policy "espacos_update" on public.espacos
  for update to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()))
  with check (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

create policy "espacos_delete" on public.espacos
  for delete to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

drop policy if exists "assentos_select" on public.assentos;
drop policy if exists "assentos_insert" on public.assentos;
drop policy if exists "assentos_update" on public.assentos;
drop policy if exists "assentos_delete" on public.assentos;

create policy "assentos_select" on public.assentos
  for select to authenticated
  using (public.same_tenant(tenant_id));

create policy "assentos_insert" on public.assentos
  for insert to authenticated
  with check (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

create policy "assentos_update" on public.assentos
  for update to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()))
  with check (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

create policy "assentos_delete" on public.assentos
  for delete to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

grant select, insert, update, delete on public.espacos, public.assentos to authenticated;
grant all on public.espacos, public.assentos to service_role;

-- ---------------------------------------------------------------------------
-- RPC: criar_espaco — cria o setor e gera as cadeiras em grade (A–Z × 1..N).
-- Executa com o usuário autenticado (RLS garante o tenant do evento).
-- ---------------------------------------------------------------------------
create or replace function public.criar_espaco(
  p_event_id uuid,
  p_nome text,
  p_price numeric,
  p_fileiras integer,
  p_cadeiras_por_fileira integer
)
returns public.espacos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_espaco public.espacos;
begin
  if not exists (select 1 from public.eventos where id = p_event_id) then
    raise exception 'Evento não encontrado.' using errcode = 'P0002';
  end if;

  insert into public.espacos (event_id, nome, price, fileiras, cadeiras_por_fileira)
  values (p_event_id, trim(p_nome), p_price, p_fileiras, p_cadeiras_por_fileira)
  returning * into v_espaco;

  insert into public.assentos (espaco_id, fileira, numero)
  select v_espaco.id, chr(64 + f), n
  from generate_series(1, p_fileiras) as f,
       generate_series(1, p_cadeiras_por_fileira) as n;

  return v_espaco;
end;
$$;

grant execute on function public.criar_espaco(uuid, text, numeric, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: liberar_reservas_expiradas — devolve à venda as cadeiras cuja reserva
-- de 30 minutos venceu e cancela os pedidos pendentes correspondentes.
-- Chamada de forma preguiçosa nas leituras de mapa/checkout.
-- ---------------------------------------------------------------------------
create or replace function public.liberar_reservas_expiradas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_liberados integer;
begin
  with liberados as (
    update public.assentos
       set status = 'livre', order_id = null, reservado_ate = null
     where status = 'reservado' and reservado_ate < now()
     returning order_id
  )
  select count(*) into v_liberados from liberados;

  update public.orders o
     set status = 'canceled'
   where o.status = 'pending'
     and o.espaco_id is not null
     and not exists (
       select 1 from public.assentos a
        where a.order_id = o.id and a.status = 'reservado'
     );

  return v_liberados;
end;
$$;

revoke all on function public.liberar_reservas_expiradas() from public, anon;
grant execute on function public.liberar_reservas_expiradas() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: reservar_assentos — reserva atômica das cadeiras escolhidas e cria o
-- pedido pendente (30 minutos para pagamento). Retorna o pedido criado.
-- ---------------------------------------------------------------------------
create or replace function public.reservar_assentos(
  p_espaco_id uuid,
  p_assento_ids uuid[],
  p_payment_method public.payment_method
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_espaco   public.espacos;
  v_customer uuid;
  v_ids      uuid[];
  v_qtd      integer;
  v_total    numeric(10,2);
  v_order    public.orders;
begin
  v_customer := public.current_pessoa_id();
  if v_customer is null then
    raise exception 'Complete seu cadastro antes de comprar.' using errcode = 'P0001';
  end if;

  select * into v_espaco from public.espacos where id = p_espaco_id;
  if not found then
    raise exception 'Setor não encontrado.' using errcode = 'P0002';
  end if;
  if not v_espaco.is_active then
    raise exception 'Este setor está pausado para vendas.' using errcode = 'P0001';
  end if;

  v_qtd := coalesce(array_length(p_assento_ids, 1), 0);
  if v_qtd < 1 or v_qtd > 10 then
    raise exception 'Escolha de 1 a 10 lugares por pedido.' using errcode = '22023';
  end if;

  -- Reservas vencidas voltam a ficar disponíveis antes de tentar adquirir.
  perform public.liberar_reservas_expiradas();

  -- Adquire as cadeiras com lock: só ficam disponíveis as ainda livres.
  select array_agg(s.id) into v_ids
  from (
    select a.id
    from public.assentos a
    where a.id = any(p_assento_ids)
      and a.espaco_id = p_espaco_id
      and a.status = 'livre'
    for update
  ) as s;

  if coalesce(array_length(v_ids, 1), 0) <> v_qtd then
    raise exception 'Alguns lugares já não estão disponíveis. Escolha outros.'
      using errcode = 'P0001';
  end if;

  v_total := round(v_espaco.price * v_qtd, 2);

  insert into public.orders (tenant_id, customer_id, event_id, espaco_id, quantity, total_amount, status, payment_method)
  values (v_espaco.tenant_id, v_customer, v_espaco.event_id, v_espaco.id, v_qtd, v_total, 'pending', p_payment_method)
  returning * into v_order;

  update public.assentos
     set order_id = v_order.id, status = 'reservado', reservado_ate = now() + interval '30 minutes'
   where id = any(v_ids);

  return v_order;
end;
$$;

revoke all on function public.reservar_assentos(uuid, uuid[], public.payment_method) from public, anon;
grant execute on function public.reservar_assentos(uuid, uuid[], public.payment_method) to authenticated;

-- ---------------------------------------------------------------------------
-- confirm_order_payment — passa a tratar também pedidos de lugar marcado:
-- vincula as cadeiras reservadas aos ingressos gerados e as marca como
-- vendidas. O caminho de lote permanece idêntico.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_order_payment(p_order_id uuid, p_hashes text[])
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_reservados integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;

  if v_order.status = 'paid' then
    return v_order;
  end if;

  if v_order.status <> 'pending' then
    raise exception 'Pedido não está pendente (status atual: %).', v_order.status
      using errcode = 'P0001';
  end if;

  if array_length(p_hashes, 1) is distinct from v_order.quantity then
    raise exception 'Esperados % ingresso(s) para o pedido, recebidos %.',
      v_order.quantity, coalesce(array_length(p_hashes, 1), 0)
      using errcode = '22023';
  end if;

  if v_order.espaco_id is not null then
    select count(*) into v_reservados
    from public.assentos
    where order_id = v_order.id and status = 'reservado';

    if v_reservados <> v_order.quantity then
      raise exception 'Reserva de lugares expirada. Refaça a compra.' using errcode = 'P0001';
    end if;

    with h as (
      select x.h, row_number() over () as rn
      from unnest(p_hashes) as x(h)
    ),
    s as (
      select a.fileira, a.numero, row_number() over (order by a.fileira, a.numero) as rn
      from public.assentos a
      where a.order_id = v_order.id and a.status = 'reservado'
    )
    insert into public.tickets (tenant_id, order_id, customer_id, qr_code_hash, espaco_id, assento_fileira, assento_numero)
    select v_order.tenant_id, v_order.id, v_order.customer_id, h.h, v_order.espaco_id, s.fileira, s.numero
    from h join s on s.rn = h.rn;

    update public.assentos a
       set status = 'vendido', reservado_ate = null, ticket_id = t.id
      from public.tickets t
     where a.order_id = v_order.id
       and a.status = 'reservado'
       and t.order_id = v_order.id
       and t.assento_fileira = a.fileira
       and t.assento_numero = a.numero;
  else
    insert into public.tickets (tenant_id, order_id, ticket_type_id, customer_id, qr_code_hash)
    select v_order.tenant_id, v_order.id, v_order.ticket_type_id, v_order.customer_id, h
    from unnest(p_hashes) as h;

    update public.ticket_types
       set quantity_sold = quantity_sold + v_order.quantity
     where id = v_order.ticket_type_id;
  end if;

  update public.orders
     set status = 'paid'
   where id = v_order.id
   returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.confirm_order_payment(uuid, text[]) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid, text[]) to service_role;
