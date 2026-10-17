import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

const espacoBodySchema = z.object({
  event_id: z.string().uuid("Evento inválido."),
  nome: z.string().trim().min(1, "Informe o nome do espaço.").max(80),
  price: z.number().min(0, "Preço não pode ser negativo.").max(100000),
  fileiras: z.number().int().min(1, "Mínimo de 1 fileira.").max(26, "Máximo de 26 fileiras (A–Z)."),
  cadeiras_por_fileira: z
    .number()
    .int()
    .min(1, "Mínimo de 1 cadeira por fileira.")
    .max(200, "Máximo de 200 cadeiras por fileira."),
});

// GET /api/tenant/espacos?event_id=... — espaços do evento com contagem de assentos.
export async function GET(request: Request) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;

  const eventId = new URL(request.url).searchParams.get("event_id");
  if (!eventId) return jsonError("Informe o parâmetro event_id.", 400);

  const supabase = await createClient();

  // Reservas vencidas voltam a ficar disponíveis antes da contagem.
  await supabase.rpc("liberar_reservas_expiradas");

  const { data: espacos, error } = await supabase
    .from("espacos")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) return jsonError(error.message, 500);

  const ids = (espacos ?? []).map((e) => e.id);
  const contagens: Record<string, { livres: number; reservados: number; vendidos: number }> = {};
  if (ids.length > 0) {
    const { data: assentos, error: assentosError } = await supabase
      .from("assentos")
      .select("espaco_id, status")
      .in("espaco_id", ids);
    if (assentosError) return jsonError(assentosError.message, 500);

    for (const assento of assentos ?? []) {
      const contagem = (contagens[assento.espaco_id] ??= {
        livres: 0,
        reservados: 0,
        vendidos: 0,
      });
      if (assento.status === "livre") contagem.livres += 1;
      else if (assento.status === "reservado") contagem.reservados += 1;
      else contagem.vendidos += 1;
    }
  }

  return NextResponse.json({
    data: (espacos ?? []).map((espaco) => ({
      ...espaco,
      ...(contagens[espaco.id] ?? { livres: 0, reservados: 0, vendidos: 0 }),
    })),
  });
}

// POST /api/tenant/espacos — cria o espaço e gera as cadeiras (Admin do Estabelecimento).
export async function POST(request: Request) {
  const guard = await apiSession(["tenant_admin"]);
  if (guard.response) return guard.response;

  const { data, response } = await parseBody(request, espacoBodySchema);
  if (response) return response;

  const supabase = await createClient();
  const { data: created, error } = await supabase.rpc("criar_espaco", {
    p_event_id: data!.event_id,
    p_nome: data!.nome,
    p_price: data!.price,
    p_fileiras: data!.fileiras,
    p_cadeiras_por_fileira: data!.cadeiras_por_fileira,
  });

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: created }, { status: 201 });
}
