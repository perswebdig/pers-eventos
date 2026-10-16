import { db } from "@/db/db";
import type { LoteLocal, PessoaLocal, TicketLocal } from "@/db/types";

const nowIso = () => new Date().toISOString();

export interface TicketDetalhe {
  ticket: TicketLocal;
  pessoa: PessoaLocal | null;
  lote: LoteLocal | null;
  eventoId: string | null;
  eventoNome: string | null;
}

// Busca um ingresso pelo hash do QR Code (validação local, funciona offline).
export async function getTicketByHash(hash: string): Promise<TicketLocal | undefined> {
  return db.tickets.where("qr_code_hash").equals(hash).first();
}

export async function getTicketDetalhe(ticket: TicketLocal): Promise<TicketDetalhe> {
  const [pessoa, lote] = await Promise.all([
    db.pessoas.get(ticket.customer_id),
    db.ticket_types.get(ticket.ticket_type_id),
  ]);
  const evento = lote ? await db.eventos.get(lote.event_id) : undefined;
  return {
    ticket,
    pessoa: pessoa ?? null,
    lote: lote ?? null,
    eventoId: evento?.id ?? lote?.event_id ?? null,
    eventoNome: evento?.nome ?? null,
  };
}

// Ingressos de um evento (o vínculo com o evento se dá via lote).
export async function listTicketsByEvento(eventoId: string): Promise<TicketLocal[]> {
  const lotes = await db.ticket_types.where("event_id").equals(eventoId).toArray();
  const loteIds = new Set(lotes.map((l) => l.id));
  const todos = await db.tickets.toArray();
  return todos.filter((t) => loteIds.has(t.ticket_type_id));
}

// Registra o check-in localmente e adiciona o hash à fila de sincronização.
// Idempotente: repetir o check-in não duplica itens na fila.
export async function fazerCheckinTicket(ticketId: string): Promise<TicketLocal | null> {
  const atual = await db.tickets.get(ticketId);
  if (!atual) return null;

  const jaEmCheckin = atual.is_checked_in;
  const checkedInAt = jaEmCheckin ? (atual.checked_in_at ?? nowIso()) : nowIso();

  const record: TicketLocal = {
    ...atual,
    is_checked_in: true,
    checked_in_at: checkedInAt,
    updated_at: nowIso(),
    sync_status: "pending",
  };
  await db.tickets.put(record);

  if (!jaEmCheckin) {
    const existente = await db.checkin_queue
      .where("ticket_id")
      .equals(ticketId)
      .first();
    if (!existente) {
      await db.checkin_queue.add({
        ticket_id: ticketId,
        qr_code_hash: atual.qr_code_hash,
        checked_in_at: checkedInAt,
        created_at: nowIso(),
      });
    }
  }

  return record;
}

export async function contagemCheckinsPendentes(): Promise<number> {
  return db.checkin_queue.count();
}

export interface ResumoVendas {
  ingressosVendidos: number;
  receita: number;
  pedidosPagos: number;
}

// Resumo de vendas (offline) a partir dos pedidos pagos já sincronizados.
export async function resumoVendas(eventoId?: string): Promise<ResumoVendas> {
  const orders = await db.orders.toArray();
  const pagos = orders.filter(
    (o) => o.status === "paid" && (!eventoId || o.event_id === eventoId),
  );
  return {
    ingressosVendidos: pagos.reduce((acc, o) => acc + (o.quantity ?? 0), 0),
    receita: pagos.reduce((acc, o) => acc + Number(o.total_amount ?? 0), 0),
    pedidosPagos: pagos.length,
  };
}
