import { NextResponse } from "next/server";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { eventoPatchSchema } from "@/features/eventos/evento-schema";
import type { Evento } from "@/types/database";

type Params = { params: Promise<{ id: string }> };

// GET /api/eventos/:id — detalhe com inscritos, pessoas disponíveis e vendas.
export async function GET(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { data: evento, error } = await supabase
    .from("eventos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!evento) return jsonError("Evento não encontrado.", 404);

  const { data: inscricoes } = await supabase
    .from("inscricoes")
    .select("*, pessoa:pessoas(*)")
    .eq("evento_id", id);

  const inscritos = [...(inscricoes ?? [])].sort((a, b) =>
    (a.pessoa?.nome_completo ?? "").localeCompare(b.pessoa?.nome_completo ?? ""),
  );

  const { data: pessoas } = await supabase
    .from("pessoas")
    .select("*")
    .order("nome_completo", { ascending: true });

  const inscritosIds = new Set(inscritos.map((i) => i.pessoa_id));
  const disponiveis = (pessoas ?? []).filter((p) => !inscritosIds.has(p.id));

  const { data: pedidosPagos } = await supabase
    .from("orders")
    .select("quantity, total_amount")
    .eq("event_id", id)
    .eq("status", "paid");

  const vendas = {
    ingressosVendidos: (pedidosPagos ?? []).reduce((acc, o) => acc + o.quantity, 0),
    receita: (pedidosPagos ?? []).reduce((acc, o) => acc + Number(o.total_amount), 0),
  };

  return NextResponse.json({
    data: { evento, inscritos, disponiveis, vendas },
  });
}

// PATCH /api/eventos/:id — atualiza (Admin do Estabelecimento).
export async function PATCH(request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const { data, response } = await parseBody(request, eventoPatchSchema);
  if (response) return response;

  const partial = data!;
  const patch: Record<string, unknown> = {};
  if (partial.nome !== undefined) patch.nome = partial.nome.trim();
  if (partial.descricao !== undefined) patch.descricao = partial.descricao.trim() || null;
  if (partial.data_inicio !== undefined) patch.data_inicio = partial.data_inicio;
  if (partial.data_fim !== undefined) patch.data_fim = partial.data_fim.trim() || null;
  if (partial.local !== undefined) patch.local = partial.local.trim() || null;
  if (partial.capacidade !== undefined)
    patch.capacidade = partial.capacidade.trim() ? Math.trunc(Number(partial.capacidade)) : null;
  if (partial.status !== undefined) patch.status = partial.status;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("eventos")
    .update(patch as Partial<Evento>)
    .eq("id", id)
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: updated });
}

// DELETE /api/eventos/:id
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ ok: true });
}
