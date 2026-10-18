import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// POST /api/inscricoes/:id/checkout — registra a saída.
export async function POST(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { data: atual, error } = await supabase
    .from("inscricoes")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!atual) return jsonError("Inscrição não encontrada.", 404);

  const { data: updated, error: updateError } = await supabase
    .from("inscricoes")
    .update({ status: "checkout", data_checkout: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updateError) return jsonError(updateError.message, 400);
  return NextResponse.json({ data: updated });
}
