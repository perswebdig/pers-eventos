import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

const syncSchema = z.object({
  checkins: z
    .array(
      z.object({
        qr_code_hash: z.string().trim().min(1),
        checked_in_at: z.string().trim().min(1),
      }),
    )
    .max(500, "Máximo de 500 check-ins por envio."),
});

function dataValida(valor: string): string {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// POST /api/tenant/check-in/sync — recebe a fila offline de check-ins de
// ingressos (Dispositivo/Recepção) e aplica no servidor de forma idempotente.
export async function POST(request: Request) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;

  const { data, response } = await parseBody(request, syncSchema);
  if (response) return response;

  const checkins = data!.checkins;
  if (checkins.length === 0) {
    return NextResponse.json({ data: { processed: 0, already: 0, not_found: [] } });
  }

  const supabase = await createClient();
  const hashes = checkins.map((c) => c.qr_code_hash);

  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("id, qr_code_hash, is_checked_in, checked_in_at")
    .in("qr_code_hash", hashes);

  if (error) return jsonError(error.message, 500);

  const porHash = new Map((tickets ?? []).map((t) => [t.qr_code_hash, t]));
  const notFound: string[] = [];
  let processed = 0;
  let already = 0;

  // Check-ins pendentes: aplica o timestamp local mais recente.
  const paraAtualizar: { id: string; checked_in_at: string }[] = [];
  for (const item of checkins) {
    const ticket = porHash.get(item.qr_code_hash);
    if (!ticket) {
      notFound.push(item.qr_code_hash);
      continue;
    }
    if (ticket.is_checked_in) {
      already += 1;
      continue;
    }
    const quando = dataValida(item.checked_in_at);
    // Mantém o registro mais antigo (primeiro check-in vence).
    const atual = paraAtualizar.find((p) => p.id === ticket.id);
    if (atual) {
      if (quando < atual.checked_in_at) atual.checked_in_at = quando;
    } else {
      paraAtualizar.push({ id: ticket.id, checked_in_at: quando });
    }
  }

  for (const item of paraAtualizar) {
    const { error: updateError } = await supabase
      .from("tickets")
      .update({ is_checked_in: true, checked_in_at: item.checked_in_at })
      .eq("id", item.id)
      .eq("is_checked_in", false);

    if (updateError) return jsonError(updateError.message, 500);
    processed += 1;
  }

  return NextResponse.json({ data: { processed, already, not_found: notFound } });
}
