import { NextResponse } from "next/server";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { pessoaPatchSchema, toPessoaPatchRow } from "@/features/pessoas/pessoa-schema";
import { ehMenor } from "@/lib/format";
import type { Pessoa } from "@/types/database";

type Params = { params: Promise<{ id: string }> };

// GET /api/pessoas/:id — detalhe com menor (responsável) e histórico de inscrições.
export async function GET(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "staff", "super_admin"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  // RLS decide o que a equipe enxerga: pessoas do tenant e pessoas vinculadas.
  const supabase = await createClient();
  const { data, error } = await supabase.from("pessoas").select("*").eq("id", id).maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Pessoa não encontrada.", 404);

  const { data: menor } = await supabase
    .from("menores")
    .select("*")
    .eq("pessoa_id", id)
    .maybeSingle();

  const { data: inscricoes } = await supabase
    .from("inscricoes")
    .select("*, evento:eventos(id, nome, data_inicio)")
    .eq("pessoa_id", id)
    .order("created_at", { ascending: false });

  const historico = (inscricoes ?? []).map((inscricao) => ({
    inscricao,
    evento: inscricao.evento ?? null,
  }));

  return NextResponse.json({ data: { pessoa: data, menor: menor ?? null, historico } });
}

// PATCH /api/pessoas/:id — atualiza pessoa.
export async function PATCH(request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "staff", "super_admin"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const { data, response } = await parseBody(request, pessoaPatchSchema);
  if (response) return response;

  const supabase = await createClient();

  // RLS limita a visibilidade (tenant ou vínculo); sem acesso, nada é visto.
  const { data: existente } = await supabase
    .from("pessoas")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!existente) {
    return jsonError("Pessoa não encontrada neste estabelecimento.", 404);
  }

  const partial = data!;
  const patch = toPessoaPatchRow(partial) as Partial<Pessoa>;

  const { data: updated, error } = await supabase
    .from("pessoas")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return jsonError(error.message, 400);

  // Sincroniza o responsável do menor: atualiza/cria quando segue menor e
  // remove o registro quando o nascimento foi corrigido para maior de idade.
  const dataNascimento = partial.data_nascimento ?? updated.data_nascimento;
  if (ehMenor(dataNascimento)) {
    const nomeResponsavel = partial.responsavel_nome?.trim();
    const cpfResponsavel = partial.responsavel_cpf
      ? partial.responsavel_cpf.replace(/\D/g, "")
      : undefined;

    if (nomeResponsavel || cpfResponsavel) {
      const { data: menorExistente } = await supabase
        .from("menores")
        .select("responsavel_nome, responsavel_cpf")
        .eq("pessoa_id", id)
        .maybeSingle();

      const menorRow = {
        pessoa_id: id,
        responsavel_nome: nomeResponsavel || menorExistente?.responsavel_nome || "",
        responsavel_cpf: cpfResponsavel || menorExistente?.responsavel_cpf || "",
      };

      if (menorRow.responsavel_nome && menorRow.responsavel_cpf) {
        const { error: menorError } = await supabase
          .from("menores")
          .upsert(menorRow, { onConflict: "pessoa_id" });
        if (menorError) return jsonError(menorError.message, 400);
      }
    }
  } else {
    await supabase.from("menores").delete().eq("pessoa_id", id);
  }

  return NextResponse.json({ data: updated });
}

// DELETE /api/pessoas/:id
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "super_admin"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;
  const { id } = await params;

  const supabase = await createClient();

  if (!ctx.isSuperAdmin && ctx.tenantId) {
    const { data: existente } = await supabase
      .from("pessoas")
      .select("id, tenant_id")
      .eq("id", id)
      .maybeSingle();

    if (!existente || existente.tenant_id !== ctx.tenantId) {
      return jsonError("Pessoa não encontrada neste estabelecimento.", 404);
    }
  }

  const { error } = await supabase.from("pessoas").delete().eq("id", id);
  if (error) return jsonError(error.message, 400);

  return NextResponse.json({ ok: true });
}
