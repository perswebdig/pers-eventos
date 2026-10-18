import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

const termoSchema = z.object({
  pessoa_id: z.string().uuid("Pessoa inválida"),
  evento_id: z.string().uuid().nullish(),
  tipo: z.enum(["responsabilidade", "imagem"]),
  assinatura_base64: z.string().trim().min(1).optional(),
});

// GET /api/termos?pessoa_id=&tipo=&evento_id= — lista aceites visíveis ao usuário.
export async function GET(request: Request) {
  const guard = await apiSession(["tenant_admin", "staff", "super_admin", "cliente"]);
  if (guard.response) return guard.response;

  const params = new URL(request.url).searchParams;
  const pessoaId = params.get("pessoa_id")?.trim() || null;
  const tipo = params.get("tipo")?.trim() || null;
  const eventoId = params.get("evento_id")?.trim() || null;

  const supabase = await createClient();
  let query = supabase
    .from("termos")
    .select("*")
    .order("aceito_em", { ascending: false })
    .limit(200);

  if (pessoaId) query = query.eq("pessoa_id", pessoaId);
  if (tipo) query = query.eq("tipo", tipo as "responsabilidade" | "imagem");
  if (eventoId) query = query.eq("evento_id", eventoId);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/termos — registra o aceite e faz upload da assinatura (assinaturas/{id}.png).
export async function POST(request: Request) {
  const guard = await apiSession(["tenant_admin", "staff", "super_admin", "cliente"]);
  if (guard.response) return guard.response;

  const { data, response } = await parseBody(request, termoSchema);
  if (response) return response;
  const values = data!;

  const supabase = await createClient();
  const termoId = crypto.randomUUID();
  let assinaturaPath: string | null = null;

  if (values.assinatura_base64) {
    const base64 = values.assinatura_base64.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Buffer.from(base64, "base64");
    assinaturaPath = `termos/${termoId}.png`;

    const { error: uploadError } = await supabase.storage
      .from("assinaturas")
      .upload(assinaturaPath, bytes, { contentType: "image/png", upsert: false });

    if (uploadError) return jsonError(`Falha ao salvar a assinatura: ${uploadError.message}`, 500);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { data: created, error } = await supabase
    .from("termos")
    .insert({
      pessoa_id: values.pessoa_id,
      evento_id: values.evento_id ?? null,
      tipo: values.tipo,
      aceito_em: new Date().toISOString(),
      ip,
      assinatura_url: assinaturaPath,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: created }, { status: 201 });
}
