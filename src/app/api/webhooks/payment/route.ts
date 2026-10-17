import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody } from "@/lib/auth/api";
import { createAdminClient } from "@/lib/supabase/admin";

const webhookSchema = z.object({
  order_id: z.string().uuid(),
  event: z.enum(["payment_succeeded", "payment_failed"]),
});

function secretValido(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

// POST /api/webhooks/payment — confirmação do provedor de pagamento.
// Autenticação via header `x-webhook-secret` (PAYMENT_WEBHOOK_SECRET).
// Usa o cliente service role porque não há sessão de usuário no provedor.
export async function POST(request: Request) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? "";
  if (!secret) return jsonError("Webhook de pagamento não configurado.", 503);

  const recebido = request.headers.get("x-webhook-secret") ?? "";
  if (!secretValido(recebido, secret)) {
    return jsonError("Assinatura do webhook inválida.", 401);
  }

  const { data, response } = await parseBody(request, webhookSchema);
  if (response) return response;

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("*")
    .eq("id", data!.order_id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!order) return jsonError("Pedido não encontrado.", 404);

  if (data!.event === "payment_failed") {
    if (order.status === "pending") {
      await admin.from("orders").update({ status: "canceled" }).eq("id", order.id);
      // Pedidos de lugar marcado devolvem as cadeiras à venda imediatamente.
      if (order.espaco_id) {
        await admin
          .from("assentos")
          .update({ status: "livre", order_id: null, reservado_ate: null })
          .eq("order_id", order.id)
          .eq("status", "reservado");
      }
    }
    return NextResponse.json({ data: { order_id: order.id, status: "canceled" } });
  }

  // Pagamento aprovado: confirmação atômica e idempotente (gera ingressos).
  const hashes = Array.from({ length: order.quantity }, () => randomBytes(32).toString("hex"));
  const { data: confirmado, error: rpcError } = await admin.rpc("confirm_order_payment", {
    p_order_id: order.id,
    p_hashes: hashes,
  });

  if (rpcError) return jsonError(rpcError.message, 409);

  return NextResponse.json({
    data: { order_id: order.id, status: confirmado?.status ?? "paid", tickets: hashes.length },
  });
}
