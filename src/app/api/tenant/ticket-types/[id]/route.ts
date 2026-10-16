import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import type { TicketType } from "@/types/database";

type Params = { params: Promise<{ id: string }> };

const lotePatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  price: z.number().min(0).max(100000).optional(),
  quantity_total: z.number().int().min(1).max(100000).optional(),
  is_active: z.boolean().optional(),
});

// PATCH /api/tenant/ticket-types/:id — atualiza lote (Admin do Estabelecimento).
export async function PATCH(request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const { data, response } = await parseBody(request, lotePatchSchema);
  if (response) return response;

  const supabase = await createClient();

  // quantity_total não pode ficar abaixo do já vendido.
  if (data!.quantity_total !== undefined) {
    const { data: atual } = await supabase
      .from("ticket_types")
      .select("quantity_sold")
      .eq("id", id)
      .maybeSingle();
    if (!atual) return jsonError("Lote não encontrado.", 404);
    if (data!.quantity_total < atual.quantity_sold) {
      return jsonError(
        `A quantidade total não pode ser menor que a já vendida (${atual.quantity_sold}).`,
        409,
      );
    }
  }

  const patch: Partial<TicketType> = {};
  if (data!.name !== undefined) patch.name = data!.name;
  if (data!.price !== undefined) patch.price = data!.price;
  if (data!.quantity_total !== undefined) patch.quantity_total = data!.quantity_total;
  if (data!.is_active !== undefined) patch.is_active = data!.is_active;

  const { data: updated, error } = await supabase
    .from("ticket_types")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: updated });
}

// DELETE /api/tenant/ticket-types/:id — exclui lote sem vendas.
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("ticket_types")
    .select("quantity_sold")
    .eq("id", id)
    .maybeSingle();

  if (!atual) return jsonError("Lote não encontrado.", 404);
  if (atual.quantity_sold > 0) {
    return jsonError(
      `Este lote já vendeu ${atual.quantity_sold} ingresso(s) e não pode ser excluído.`,
      409,
    );
  }

  const { error } = await supabase.from("ticket_types").delete().eq("id", id);
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ ok: true });
}
