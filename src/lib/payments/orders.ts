import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type AdminClient = SupabaseClient<Database>;

export interface ResultadoConfirmacao {
  orderId: string;
  status: string;
  tickets: number;
  jaConfirmado: boolean;
}

// Confirma o pagamento de um pedido pendente (gera ingressos). Idempotente:
// pedidos já pagos apenas retornam o estado atual.
export async function confirmarPagamentoDoPedido(
  admin: AdminClient,
  orderId: string,
): Promise<ResultadoConfirmacao> {
  const { data: order, error } = await admin
    .from("orders")
    .select("id, quantity, status")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) throw new Error("Pedido não encontrado.");

  if (order.status === "paid") {
    return { orderId: order.id, status: "paid", tickets: 0, jaConfirmado: true };
  }
  if (order.status !== "pending") {
    throw new Error("Este pedido não está aguardando pagamento.");
  }

  const hashes = Array.from({ length: order.quantity }, () => randomBytes(32).toString("hex"));
  const { data: confirmado, error: rpcError } = await admin.rpc("confirm_order_payment", {
    p_order_id: order.id,
    p_hashes: hashes,
  });

  if (rpcError) throw new Error(rpcError.message);

  return {
    orderId: order.id,
    status: confirmado?.status ?? "paid",
    tickets: hashes.length,
    jaConfirmado: false,
  };
}

export interface ResultadoCancelamento {
  orderId: string;
  jaProcessado: boolean;
}

// Cancela um pedido pendente e devolve as cadeiras reservadas à venda.
export async function cancelarPedido(
  admin: AdminClient,
  orderId: string,
): Promise<ResultadoCancelamento> {
  const { data: order, error } = await admin
    .from("orders")
    .select("id, status, espaco_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!order) throw new Error("Pedido não encontrado.");

  if (order.status !== "pending") {
    return { orderId: order.id, jaProcessado: true };
  }

  const { error: updateError } = await admin
    .from("orders")
    .update({ status: "canceled" })
    .eq("id", order.id);
  if (updateError) throw new Error(updateError.message);

  if (order.espaco_id) {
    const { error: seatsError } = await admin
      .from("assentos")
      .update({ status: "livre", order_id: null, reservado_ate: null })
      .eq("order_id", order.id)
      .eq("status", "reservado");
    if (seatsError) throw new Error(seatsError.message);
  }

  return { orderId: order.id, jaProcessado: false };
}
