import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import type { Inscricao } from "@/types/database";

type Params = { params: Promise<{ id: string }> };

const inscricaoPatchSchema = z.object({
  status: z.enum(["inscrito", "confirmado", "checkin", "checkout", "cancelado"]).optional(),
  pagamento_status: z.enum(["pendente", "pago", "isento", "reembolsado"]).optional(),
  valor: z.string().trim().optional(),
  forma_pagamento: z.string().trim().optional(),
});

// GET /api/inscricoes/:id — detalhe para conferência na recepção.
export async function GET(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inscricoes")
    .select("*, pessoa:pessoas(*), evento:eventos(id, nome, data_inicio)")
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Inscrição não encontrada.", 404);

  const { pessoa, evento, ...inscricao } = data;
  return NextResponse.json({
    data: { inscricao, pessoa: pessoa ?? null, evento: evento ?? null },
  });
}

// PATCH /api/inscricoes/:id — atualiza status/pagamento da inscrição.
export async function PATCH(request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const { data, response } = await parseBody(request, inscricaoPatchSchema);
  if (response) return response;
  const values = data!;

  const patch: Record<string, unknown> = {};
  if (values.status !== undefined) patch.status = values.status;
  if (values.pagamento_status !== undefined) patch.pagamento_status = values.pagamento_status;
  if (values.valor !== undefined) {
    const n = values.valor.trim() ? Number(values.valor.replace(",", ".")) : null;
    patch.valor = Number.isFinite(n) ? n : null;
  }
  if (values.forma_pagamento !== undefined)
    patch.forma_pagamento = values.forma_pagamento.trim() || null;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("inscricoes")
    .update(patch as Partial<Inscricao>)
    .eq("id", id)
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  if (!updated) return jsonError("Inscrição não encontrada.", 404);
  return NextResponse.json({ data: updated });
}

// DELETE /api/inscricoes/:id
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { error } = await supabase.from("inscricoes").delete().eq("id", id);
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ ok: true });
}
