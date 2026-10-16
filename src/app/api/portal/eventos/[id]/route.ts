import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// GET /api/portal/eventos/:id — evento + lotes disponíveis (página de checkout).
export async function GET(_request: Request, { params }: Params) {
  const guard = await apiSession(["cliente", "tenant_admin", "staff"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { data: evento, error } = await supabase
    .from("eventos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!evento) return jsonError("Evento não encontrado.", 404);

  const { data: lotes, error: lotesError } = await supabase
    .from("ticket_types")
    .select("*")
    .eq("event_id", id)
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (lotesError) return jsonError(lotesError.message, 500);

  return NextResponse.json({ data: { evento, lotes: lotes ?? [] } });
}
