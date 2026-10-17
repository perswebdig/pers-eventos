import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

// GET /api/portal/estabelecimentos — estabelecimentos ativos para o seletor.
export async function GET() {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estabelecimentos")
    .select("id, nome, cidade, estado, endereco, logo_url")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
}

const selecionarSchema = z.object({
  estabelecimento_id: z.string().uuid("Estabelecimento inválido."),
});

// POST /api/portal/estabelecimentos — define/troca o estabelecimento ativo.
export async function POST(request: Request) {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;

  const { data, response } = await parseBody(request, selecionarSchema);
  if (response) return response;

  const supabase = await createClient();
  const { data: estabelecimento, error } = await supabase.rpc("selecionar_estabelecimento", {
    p_tenant_id: data!.estabelecimento_id,
  });

  if (error) {
    if (error.message.includes("indisponível")) return jsonError(error.message, 404);
    return jsonError(error.message, 400);
  }

  return NextResponse.json({ data: estabelecimento });
}
