import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { isDemoMode } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelarPedido } from "@/lib/payments/orders";

type Params = { params: Promise<{ id: string }> };

// POST /api/tenant/pedidos/:id/cancelar — modo demonstração: cancela um pedido
// pendente e devolve as cadeiras reservadas à venda.
export async function POST(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  if (!isDemoMode()) {
    return jsonError("Modo demonstração desativado.", 403);
  }
  if (!ctx.tenantId) return jsonError("Usuário sem estabelecimento.", 403);

  const { id } = await params;
  const admin = createAdminClient();

  const { data: order, error } = await admin
    .from("orders")
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!order) return jsonError("Pedido não encontrado.", 404);
  if (order.tenant_id !== ctx.tenantId) {
    return jsonError("Pedido de outro estabelecimento.", 403);
  }

  try {
    const resultado = await cancelarPedido(admin, order.id);
    return NextResponse.json({ data: resultado });
  } catch (err) {
    return jsonError((err as Error).message, 409);
  }
}
