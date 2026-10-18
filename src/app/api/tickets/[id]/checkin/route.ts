import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// POST /api/tickets/:id/checkin — libera a entrada do ingresso (idempotente).
export async function POST(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { data: atual, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!atual) return jsonError("Ingresso não encontrado.", 404);

  if (atual.is_checked_in) {
    return NextResponse.json({ data: atual });
  }

  const { data: updated, error: updateError } = await supabase
    .from("tickets")
    .update({ is_checked_in: true, checked_in_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updateError) return jsonError(updateError.message, 400);
  return NextResponse.json({ data: updated });
}
