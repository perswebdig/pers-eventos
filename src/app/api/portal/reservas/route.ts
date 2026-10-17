import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

const reservaSchema = z.object({
  espaco_id: z.string().uuid("Setor inválido."),
  assento_ids: z
    .array(z.string().uuid("Lugar inválido."))
    .min(1, "Escolha pelo menos 1 lugar.")
    .max(10, "Máximo de 10 lugares por pedido."),
  payment_method: z.enum(["pix", "credit_card"], { message: "Forma de pagamento inválida." }),
});

// POST /api/portal/reservas — reserva cadeiras (30 min) e cria o pedido pendente.
export async function POST(request: Request) {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  if (!ctx.pessoaId) return jsonError("Complete seu cadastro antes de comprar.", 409);

  const { data, response } = await parseBody(request, reservaSchema);
  if (response) return response;

  const supabase = await createClient();
  const { data: pedido, error } = await supabase.rpc("reservar_assentos", {
    p_espaco_id: data!.espaco_id,
    p_assento_ids: data!.assento_ids,
    p_payment_method: data!.payment_method,
  });

  if (error) {
    const indisponivel =
      error.message.includes("já não estão disponíveis") ||
      error.message.includes("pausado") ||
      error.message.includes("Complete seu cadastro");
    return jsonError(error.message, indisponivel ? 409 : 400);
  }

  return NextResponse.json({ data: pedido }, { status: 201 });
}
