import { NextResponse } from "next/server";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { onlyDigits } from "@/lib/cpf";
import { vincularPessoaSchema } from "@/features/pessoas/vincular-schema";

// POST /api/tenant/pessoas/vincular — adiciona à base do estabelecimento uma
// pessoa que já existe na plataforma (busca por CPF ou e-mail).
export async function POST(request: Request) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;

  const { data, response } = await parseBody(request, vincularPessoaSchema);
  if (response) return response;

  const supabase = await createClient();
  const { data: pessoa, error } = await supabase.rpc("vincular_pessoa", {
    p_cpf: data!.cpf ? onlyDigits(data!.cpf) : null,
    p_email: data!.email ?? null,
  });

  if (error) {
    if (error.message.includes("Nenhuma pessoa encontrada")) return jsonError(error.message, 404);
    if (error.message.includes("Apenas a equipe")) return jsonError(error.message, 403);
    return jsonError(error.message, 400);
  }

  return NextResponse.json({ data: pessoa });
}
