-- =============================================================================
-- PersEventos — Fase 2 (complemento): confirmação atômica e idempotente do
-- pagamento de um pedido (webhook). Gera os ingressos, incrementa o vendido
-- do lote e marca o pedido como pago em uma única transação.
-- Os hashes dos QR Codes são gerados no servidor (crypto.randomBytes) e
-- enviados por parâmetro; a função é SECURITY DEFINER e só o service_role
-- pode executá-la.
-- =============================================================================
create or replace function public.confirm_order_payment(p_order_id uuid, p_hashes text[])
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;

  -- Idempotência: chamadas repetidas devolvem o pedido já pago.
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

  insert into public.tickets (tenant_id, order_id, ticket_type_id, customer_id, qr_code_hash)
  select v_order.tenant_id, v_order.id, v_order.ticket_type_id, v_order.customer_id, h
  from unnest(p_hashes) as h;

  update public.ticket_types
     set quantity_sold = quantity_sold + v_order.quantity
   where id = v_order.ticket_type_id;

  update public.orders
     set status = 'paid'
   where id = v_order.id
   returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.confirm_order_payment(uuid, text[]) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid, text[]) to service_role;
