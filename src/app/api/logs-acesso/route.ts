import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

const logSchema = z.object({
  pessoa_id: z.string().uuid().nullish(),
  acao: z.string().trim().min(1).max(120),
});

// GET /api/logs-acesso?pessoa_id= — leitura restrita ao admin do estabelecimento.
export async function GET(request: Request) {
  const guard = await apiSession(["tenant_admin", "super_admin"]);
  if (guard.response) return guard.response;

  const pessoaId = new URL(request.url).searchParams.get("pessoa_id")?.trim() || null;

  const supabase = await createClient();
  let query = supabase
    .from("log_acesso_dados")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(100);

  if (pessoaId) query = query.eq("pessoa_id", pessoaId);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/logs-acesso — registra o próprio acesso (LGPD).
export async function POST(request: Request) {
  const guard = await apiSession(["tenant_admin", "staff", "super_admin", "cliente"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  const { data, response } = await parseBody(request, logSchema);
  if (response) return response;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("log_acesso_dados")
    .insert({
      user_id: ctx.userId,
      pessoa_id: data!.pessoa_id ?? null,
      acao: data!.acao,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: created }, { status: 201 });
}
