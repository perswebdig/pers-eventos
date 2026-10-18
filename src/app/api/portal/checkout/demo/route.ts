import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { isDemoMode } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmarPagamentoDoPedido } from "@/lib/payments/orders";

const schema = z.object({ order_id: z.string().uuid() });

// POST /api/portal/checkout/demo — modo demonstração: o próprio cliente
// confirma o pagamento do seu pedido e recebe os ingressos na hora.
export async function POST(request: Request) {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  if (!isDemoMode()) {
    return jsonError("Modo demonstração desativado.", 403);
  }
  if (!ctx.pessoaId) {
    return jsonError("Complete seu cadastro antes de pagar.", 409);
  }

  const { data, response } = await parseBody(request, schema);
  if (response) return response;

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, customer_id")
    .eq("id", data!.order_id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!order) return jsonError("Pedido não encontrado.", 404);
  if (order.customer_id !== ctx.pessoaId) {
    return jsonError("Este pedido não pertence a você.", 403);
  }

  try {
    const resultado = await confirmarPagamentoDoPedido(admin, order.id);
    return NextResponse.json({ data: resultado });
  } catch (err) {
    return jsonError((err as Error).message, 409);
  }
}
