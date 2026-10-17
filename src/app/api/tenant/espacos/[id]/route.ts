import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import type { Espaco } from "@/types/database";

type Params = { params: Promise<{ id: string }> };

const espacoPatchSchema = z.object({
  nome: z.string().trim().min(1).max(80).optional(),
  price: z.number().min(0).max(100000).optional(),
  is_active: z.boolean().optional(),
});

// PATCH /api/tenant/espacos/:id — atualiza nome/preço/status (Admin do Estabelecimento).
export async function PATCH(request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const { data, response } = await parseBody(request, espacoPatchSchema);
  if (response) return response;

  const patch: Partial<Espaco> = {};
  if (data!.nome !== undefined) patch.nome = data!.nome;
  if (data!.price !== undefined) patch.price = data!.price;
  if (data!.is_active !== undefined) patch.is_active = data!.is_active;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("espacos")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: updated });
}

// DELETE /api/tenant/espacos/:id — exclui espaço sem lugares reservados/vendidos.
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("assentos")
    .select("id", { count: "exact", head: true })
    .eq("espaco_id", id)
    .in("status", ["reservado", "vendido"]);

  if (countError) return jsonError(countError.message, 500);
  if ((count ?? 0) > 0) {
    return jsonError(
      `Este espaço tem ${count} lugar(es) reservado(s)/vendido(s) e não pode ser excluído.`,
      409,
    );
  }

  const { error } = await supabase.from("espacos").delete().eq("id", id);
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ ok: true });
}
