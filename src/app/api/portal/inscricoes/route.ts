import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "../../../lib/supabase/server";

// GET /api/portal/inscricoes — inscrições do cliente logado (+ evento).
export async function GET() {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  if (!ctx.pessoaId) return NextResponse.json({ data: [] });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inscricoes")
    .select("*, evento:eventos(*)")
    .eq("pessoa_id", ctx.pessoaId)
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
}

const inscricaoSchema = z.object({ evento_id: z.string().trim().uuid() });

// POST /api/portal/inscricoes — inscreve o cliente em um evento do tenant.
export async function POST(request: Request) {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  if (!ctx.pessoaId) {
    return jsonError("Complete seu cadastro antes de se inscrever.", 409);
  }

  const { data, response } = await parseBody(request, inscricaoSchema);
  if (response) return response;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("inscricoes")
    .insert({
      pessoa_id: ctx.pessoaId,
      evento_id: data!.evento_id,
      status: "inscrito",
      pagamento_status: "pendente",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonError("Você já está inscrito neste evento.", 409);
    }
    return jsonError(error.message, 400);
  }
  return NextResponse.json({ data: created }, { status: 201 });
}
