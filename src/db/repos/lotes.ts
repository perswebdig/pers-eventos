import { db } from "@/db/db";
import { deleteLocal, saveLocal } from "@/db/queue";
import type { LoteLocal } from "@/db/types";

const nowIso = () => new Date().toISOString();

export interface LoteInput {
  id?: string;
  event_id: string;
  name: string;
  price: number;
  quantity_total: number;
  is_active: boolean;
}

// Lotes de ingressos de um evento, do mais antigo para o mais novo.
export async function listLotesByEvento(eventoId: string): Promise<LoteLocal[]> {
  const lotes = await db.ticket_types.where("event_id").equals(eventoId).toArray();
  return lotes.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getLote(id: string): Promise<LoteLocal | undefined> {
  return db.ticket_types.get(id);
}

// Cria/atualiza um lote localmente (offline-first) e enfileira o envio.
export async function saveLote(input: LoteInput): Promise<LoteLocal> {
  const id = input.id ?? crypto.randomUUID();
  const existente = await db.ticket_types.get(id);

  if (input.quantity_total < (existente?.quantity_sold ?? 0)) {
    throw new Error(
      `A quantidade total não pode ser menor que a já vendida (${existente?.quantity_sold ?? 0}).`,
    );
  }

  const record: LoteLocal = {
    id,
    tenant_id: existente?.tenant_id ?? null,
    event_id: input.event_id,
    name: input.name,
    price: input.price,
    quantity_total: input.quantity_total,
    quantity_sold: existente?.quantity_sold ?? 0,
    is_active: input.is_active,
    created_at: existente?.created_at ?? nowIso(),
    updated_at: nowIso(),
    sync_status: "pending",
  };

  await saveLocal(db, "ticket_types", record);
  return record;
}

export async function toggleLoteAtivo(id: string, ativo: boolean): Promise<LoteLocal | null> {
  const atual = await db.ticket_types.get(id);
  if (!atual) return null;
  const record: LoteLocal = { ...atual, is_active: ativo, updated_at: nowIso() };
  await saveLocal(db, "ticket_types", record);
  return record;
}

// Remove o lote (bloqueia se já houver ingressos vendidos).
export async function removeLote(id: string): Promise<void> {
  const atual = await db.ticket_types.get(id);
  if (!atual) return;
  if (atual.quantity_sold > 0) {
    throw new Error(
      `Este lote já vendeu ${atual.quantity_sold} ingresso(s) e não pode ser excluído.`,
    );
  }
  await deleteLocal(db, "ticket_types", id);
}

export function loteDisponivel(lote: LoteLocal): number {
  return Math.max(0, lote.quantity_total - lote.quantity_sold);
}
