import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { isSupabaseAdminConfigured } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const checkoutSchema = z.object({
  ticket_type_id: z.string().uuid("Lote inválido."),
  quantity: z.number().int().min(1, "Mínimo de 1 ingresso.").max(10, "Máximo de 10 por pedido."),
  payment_method: z.enum(["pix", "credit_card"], { message: "Forma de pagamento inválida." }),
});

// POST /api/checkout — cliente cria um pedido pendente de pagamento.
export async function POST(request: Request) {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  if (!ctx.pessoaId) return jsonError("Complete seu cadastro antes de comprar.", 409);
  if (!ctx.tenantId) return jsonError("Escolha um estabelecimento antes de comprar.", 409);
  if (!ctx.tenantId) return jsonError("Seu perfil não está vinculado a um estabelecimento.", 409);

  const { data, response } = await parseBody(request, checkoutSchema);
  if (response) return response;

  const supabase = await createClient();
  const { data: lote, error: loteError } = await supabase
    .from("ticket_types")
    .select("*")
    .eq("id", data!.ticket_type_id)
    .maybeSingle();

  if (loteError) return jsonError(loteError.message, 500);
  if (!lote) return jsonError("Lote não encontrado.", 404);
  if (!lote.is_active) return jsonError("Este lote está pausado para vendas.", 409);

  // Pedidos pendentes ainda não entram em quantity_sold; contamos os dois para
  // não vender acima do total. A leitura administrativa contorna a RLS, que
  // esconderia pedidos de outros clientes.
  let reservado = 0;
  if (isSupabaseAdminConfigured) {
    const admin = createAdminClient();
    const { data: pendentes } = await admin
      .from("orders")
      .select("quantity")
      .eq("ticket_type_id", lote.id)
      .eq("status", "pending");
    reservado = (pendentes ?? []).reduce((acc, o) => acc + (o.quantity ?? 0), 0);
  } else {
    const { data: proprios } = await supabase
      .from("orders")
      .select("quantity")
      .eq("ticket_type_id", lote.id)
      .eq("status", "pending");
    reservado = (proprios ?? []).reduce((acc, o) => acc + (o.quantity ?? 0), 0);
  }

  const disponivel = lote.quantity_total - lote.quantity_sold - reservado;
  if (disponivel < data!.quantity) {
    return jsonError(
      disponivel <= 0
        ? "Este lote está esgotado."
        : `Restam apenas ${disponivel} ingresso(s) neste lote.`,
      409,
    );
  }

  const total = Math.round(Number(lote.price) * data!.quantity * 100) / 100;

  const { data: created, error } = await supabase
    .from("orders")
    .insert({
      customer_id: ctx.pessoaId,
      event_id: lote.event_id,
      ticket_type_id: lote.id,
      quantity: data!.quantity,
      total_amount: total,
      status: "pending",
      payment_method: data!.payment_method,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: created }, { status: 201 });
}
