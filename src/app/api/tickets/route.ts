import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

// GET /api/tickets?hash=<qr_code_hash> — conferência de ingresso na recepção.
export async function GET(request: Request) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;

  const hash = new URL(request.url).searchParams.get("hash")?.trim().toLowerCase() ?? "";
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return jsonError("Informe o hash do QR code.", 400);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("*, pessoa:pessoas(*), lote:ticket_types(*, evento:eventos(id, nome))")
    .eq("qr_code_hash", hash)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Ingresso não encontrado.", 404);

  const { pessoa, lote, ...ticket } = data;
  return NextResponse.json({
    data: {
      ticket,
      pessoa: pessoa ?? null,
      lote: lote ?? null,
      eventoId: lote?.evento?.id ?? null,
      eventoNome: lote?.evento?.nome ?? null,
    },
  });
}
