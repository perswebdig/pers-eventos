import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// POST /api/inscricoes/:id/checkin — registra a entrada (idempotente; nova
// entrada depois de um checkout gera novo horário).
export async function POST(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { data: atual, error } = await supabase
    .from("inscricoes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!atual) return jsonError("Inscrição não encontrada.", 404);

  const jaEmCheckin = atual.status === "checkin";
  const agora = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("inscricoes")
    .update({
      status: "checkin",
      data_checkin: jaEmCheckin ? (atual.data_checkin ?? agora) : agora,
      data_checkout: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) return jsonError(updateError.message, 400);
  return NextResponse.json({ data: updated });
}
