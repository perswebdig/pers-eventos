import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

const loteBodySchema = z.object({
  event_id: z.string().uuid("Evento inválido."),
  name: z.string().trim().min(1, "Informe o nome do lote.").max(80),
  price: z.number().min(0, "Preço não pode ser negativo.").max(100000),
  quantity_total: z.number().int().min(1, "Quantidade mínima é 1.").max(100000),
  is_active: z.boolean().optional().default(true),
});

// GET /api/tenant/ticket-types?event_id=... — lotes de um evento.
export async function GET(request: Request) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;

  const eventId = new URL(request.url).searchParams.get("event_id");
  if (!eventId) return jsonError("Informe o parâmetro event_id.", 400);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ticket_types")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/tenant/ticket-types — cria lote (Admin do Estabelecimento).
export async function POST(request: Request) {
  const guard = await apiSession(["tenant_admin"]);
  if (guard.response) return guard.response;

  const { data, response } = await parseBody(request, loteBodySchema);
  if (response) return response;

  const supabase = await createClient();
  // tenant_id é carimbado pelo trigger set_tenant_id a partir do perfil.
  const { data: created, error } = await supabase
    .from("ticket_types")
    .insert({
      event_id: data!.event_id,
      name: data!.name,
      price: data!.price,
      quantity_total: data!.quantity_total,
      is_active: data!.is_active,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: created }, { status: 201 });
}
