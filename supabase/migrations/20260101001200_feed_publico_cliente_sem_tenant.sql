-- PersEventos — 01200: catálogo público (feed) e cliente sem estabelecimento ativo
--
-- Com o feed de eventos de todos os estabelecimentos, o cliente deixa de
-- escolher um "estabelecimento ativo": ele navega o catálogo público e compra o
-- evento que quiser. O vínculo com o estabelecimento passa a nascer da compra/
-- inscrição (trigger auto_vincular_pessoa, migração 01100). Esta migração:
--   1) libera a leitura, para clientes, de eventos abertos/planejados de
--      estabelecimentos ativos e de seus lotes, espaços e cadeiras (catálogo);
--   2) torna pedidos/ingressos do próprio cliente visíveis sem depender do
--      tenant ativo do perfil;
--   3) permite o INSERT do cliente (pessoa, menor, inscrição, pedido, termo)
--      sem tenant ativo — o set_tenant_id v3 aceita o tenant do evento quando
--      o cliente não tem estabelecimento escolhido.

-- ---------------------------------------------------------------------------
-- 1) set_tenant_id v3 — INSERT do cliente aceita o tenant do evento relacionado
-- ---------------------------------------------------------------------------
create or replace function public.set_tenant_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento        uuid;
  v_tenant_evento uuid;
begin
  -- service_role / migrações / SQL direto: não há sessão de usuário.
  if (select auth.uid()) is null then
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
      -- Cliente sem estabelecimento ativo: aceita o tenant do evento
      -- relacionado (compra/inscrição no catálogo público).
      if public.is_cliente() then
        if tg_table_name = 'orders' then
          v_evento := new.event_id;
        elsif tg_table_name = 'inscricoes' then
          v_evento := new.evento_id;
        end if;

        if v_evento is not null then
          select e.tenant_id into v_tenant_evento
          from public.eventos e
          where e.id = v_evento;

          if new.tenant_id is not distinct from v_tenant_evento then
            return new;
          end if;
        end if;
      end if;

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
-- 2) Catálogo público: eventos abertos/planejados de estabelecimentos ativos
-- ---------------------------------------------------------------------------
drop policy if exists "eventos_select" on public.eventos;
create policy "eventos_select" on public.eventos
  for select to authenticated
  using (
    public.same_tenant(tenant_id)
    or (
      eventos.status in ('aberto', 'planejado')
      and exists (
        select 1 from public.estabelecimentos e
        where e.id = eventos.tenant_id and e.ativo
      )
    )
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
      select 1
      from public.eventos ev
      join public.estabelecimentos e on e.id = ev.tenant_id
      where ev.id = ticket_types.event_id
        and ev.status in ('aberto', 'planejado')
        and e.ativo
    )
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
      select 1
      from public.eventos ev
      join public.estabelecimentos e on e.id = ev.tenant_id
      where ev.id = espacos.event_id
        and ev.status in ('aberto', 'planejado')
        and e.ativo
    )
    or exists (
      select 1 from public.orders o
       where o.espaco_id = espacos.id
         and o.customer_id = public.current_pessoa_id()
    )
  );

drop policy if exists "assentos_select" on public.assentos;
create policy "assentos_select" on public.assentos
  for select to authenticated
  using (
    public.same_tenant(tenant_id)
    or exists (
      select 1
      from public.espacos sp
      join public.eventos ev on ev.id = sp.event_id
      join public.estabelecimentos e on e.id = ev.tenant_id
      where sp.id = assentos.espaco_id
        and ev.status in ('aberto', 'planejado')
        and e.ativo
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Pedidos e ingressos do cliente visíveis sem depender do tenant ativo
-- ---------------------------------------------------------------------------
drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders
  for select to authenticated
  using (
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

drop policy if exists "orders_insert" on public.orders;
create policy "orders_insert" on public.orders
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      customer_id = public.current_pessoa_id()
      and tenant_id = (select ev.tenant_id from public.eventos ev where ev.id = orders.event_id)
    )
    or (public.same_tenant(tenant_id) and public.is_staff_or_admin())
  );

-- ---------------------------------------------------------------------------
-- 4) INSERT do cliente sem tenant ativo
-- ---------------------------------------------------------------------------
drop policy if exists "pessoas_insert" on public.pessoas;
create policy "pessoas_insert" on public.pessoas
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.same_tenant(tenant_id) and public.is_staff_or_admin())
    or (public.is_cliente() and (tenant_id is null or public.same_tenant(tenant_id)))
  );

drop policy if exists "menores_insert" on public.menores;
create policy "menores_insert" on public.menores
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.same_tenant(tenant_id) and public.is_staff_or_admin())
    or (public.is_cliente() and (tenant_id is null or public.same_tenant(tenant_id)))
  );

drop policy if exists "inscricoes_insert" on public.inscricoes;
create policy "inscricoes_insert" on public.inscricoes
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      pessoa_id = public.current_pessoa_id()
      and tenant_id = (select ev.tenant_id from public.eventos ev where ev.id = inscricoes.evento_id)
    )
    or (public.same_tenant(tenant_id) and public.is_staff_or_admin())
  );

drop policy if exists "termos_insert" on public.termos;
create policy "termos_insert" on public.termos
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.same_tenant(tenant_id) and public.is_staff_or_admin())
    or (
      public.is_cliente()
      and pessoa_id = public.current_pessoa_id()
      and (tenant_id is null or public.same_tenant(tenant_id))
    )
  );
