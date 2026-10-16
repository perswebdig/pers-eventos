import { NextResponse } from "next/server";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from '@/lib/supabase/server';
import {
  pessoaSchema,
  toMenorRow,
  toPessoaRow,
} from "@/features/pessoas/pessoa-schema";
import { ehMenor } from "@/lib/format";

// GET /api/portal/perfil — dados da pessoa vinculada ao cliente logado.
export async function GET() {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  if (!ctx.pessoaId) {
    return NextResponse.json({ data: { pessoa: null, menor: null } });
  }

  const supabase = await createClient();
  const { data: pessoa, error } = await supabase
    .from("pessoas")
    .select("*")
    .eq("id", ctx.pessoaId)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);

  let menor = null;
  if (pessoa) {
    const { data } = await supabase
      .from("menores")
      .select("*")
      .eq("pessoa_id", pessoa.id)
      .maybeSingle();
    menor = data ?? null;
  }

  return NextResponse.json({ data: { pessoa: pessoa ?? null, menor } });
}

// PUT /api/portal/perfil — cria/atualiza os próprios dados e aceita a LGPD.
export async function PUT(request: Request) {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  const { data, response } = await parseBody(request, pessoaSchema);
  if (response) return response;
  const values = data!;

  const supabase = await createClient();
  const row = toPessoaRow(values);

  let pessoaId = ctx.pessoaId;

  if (pessoaId) {
    const { error } = await supabase
      .from("pessoas")
      .update(row)
      .eq("id", pessoaId);
    if (error) return jsonError(error.message, 400);
  } else {
    const { data: created, error } = await supabase
      .from("pessoas")
      .insert(row)
      .select("id")
      .single();
    if (error) return jsonError(error.message, 400);
    pessoaId = created.id;

    // Vincula a pessoa ao perfil do usuário (auto-relacionamento do cliente).
    const { error: linkError } = await supabase
      .from("profiles")
      .update({ pessoa_id: pessoaId, nome: values.nome_completo.trim() })
      .eq("id", ctx.userId);
    if (linkError) return jsonError(linkError.message, 400);
  }

  // Mantém os dados do responsável quando o visitante é menor de idade.
  if (ehMenor(values.data_nascimento)) {
    const menorRow = toMenorRow(values, pessoaId!);
    const { data: existente } = await supabase
      .from("menores")
      .select("id")
      .eq("pessoa_id", pessoaId!)
      .maybeSingle();
    if (existente) {
      await supabase.from("menores").update(menorRow).eq("id", existente.id);
    } else {
      await supabase.from("menores").insert(menorRow);
    }
  }

  return NextResponse.json({ data: { pessoa_id: pessoaId } });
}
