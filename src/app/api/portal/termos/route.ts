import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from '@/lib/supabase/server';

// GET /api/portal/termos — termos (LGPD) aceitos pelo cliente logado.
export async function GET() {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  if (!ctx.pessoaId) return NextResponse.json({ data: [] });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("termos")
    .select("*")
    .eq("pessoa_id", ctx.pessoaId)
    .order("aceito_em", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
}

const aceiteSchema = z.object({
  tipo: z.enum(["responsabilidade", "imagem"]),
  evento_id: z.string().trim().uuid().nullable().optional(),
});

// POST /api/portal/termos — registra o aceite do termo pelo cliente.
export async function POST(request: Request) {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  if (!ctx.pessoaId) {
    return jsonError("Complete seu cadastro antes de aceitar os termos.", 409);
  }

  const { data, response } = await parseBody(request, aceiteSchema);
  if (response) return response;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("termos")
    .insert({
      pessoa_id: ctx.pessoaId,
      tipo: data!.tipo,
      evento_id: data!.evento_id ?? null,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: created }, { status: 201 });
}
