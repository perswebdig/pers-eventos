import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/db/db";
import {
  listLotesByEvento,
  loteDisponivel,
  removeLote,
  saveLote,
  toggleLoteAtivo,
} from "@/db/repos/lotes";
import {
  contagemCheckinsPendentes,
  fazerCheckinTicket,
  getTicketByHash,
  resumoVendas,
} from "@/db/repos/ingressos";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("db/repos/lotes", () => {
  it("cria lote com sync pendente e enfileira o envio", async () => {
    const lote = await saveLote({
      event_id: "ev1",
      name: "1º Lote",
      price: 50,
      quantity_total: 100,
      is_active: true,
    });

    expect(lote.sync_status).toBe("pending");
    const salvos = await db.ticket_types.where("event_id").equals("ev1").toArray();
    expect(salvos).toHaveLength(1);

    const fila = await db.sync_queue
      .where("[entidade+entidade_id]")
      .equals(["ticket_types", lote.id])
      .toArray();
    expect(fila).toHaveLength(1);
    expect(fila[0].operacao).toBe("insert");
  });

  it("bloqueia quantity_total menor que a já vendida", async () => {
    const lote = await saveLote({
      event_id: "ev1",
      name: "1º Lote",
      price: 50,
      quantity_total: 10,
      is_active: true,
    });
    await db.ticket_types.update(lote.id, { quantity_sold: 5 });

    await expect(
      saveLote({
        id: lote.id,
        event_id: "ev1",
        name: "1º Lote",
        price: 50,
        quantity_total: 3,
        is_active: true,
      }),
    ).rejects.toThrow(/já vendida/);
  });

  it("pausa/reativa e exclui lote sem vendas", async () => {
    const lote = await saveLote({
      event_id: "ev1",
      name: "Lote",
      price: 0,
      quantity_total: 10,
      is_active: true,
    });

    const pausado = await toggleLoteAtivo(lote.id, false);
    expect(pausado?.is_active).toBe(false);
    expect(loteDisponivel(pausado!)).toBe(10);

    await removeLote(lote.id);
    expect(await db.ticket_types.get(lote.id)).toBeUndefined();
  });

  it("não exclui lote com ingressos vendidos", async () => {
    const lote = await saveLote({
      event_id: "ev1",
      name: "Lote",
      price: 0,
      quantity_total: 10,
      is_active: true,
    });
    await db.ticket_types.update(lote.id, { quantity_sold: 2 });

    await expect(removeLote(lote.id)).rejects.toThrow(/não pode ser excluído/);
  });

  it("lista lotes do evento em ordem de criação", async () => {
    const a = await saveLote({
      event_id: "ev1",
      name: "1º",
      price: 0,
      quantity_total: 1,
      is_active: true,
    });
    const b = await saveLote({
      event_id: "ev1",
      name: "2º",
      price: 0,
      quantity_total: 1,
      is_active: true,
    });
    await db.ticket_types.update(a.id, { created_at: "2026-01-01T00:00:00.000Z" });
    await db.ticket_types.update(b.id, { created_at: "2026-02-01T00:00:00.000Z" });

    const lista = await listLotesByEvento("ev1");
    expect(lista.map((l) => l.name)).toEqual(["1º", "2º"]);
  });
});

describe("db/repos/ingressos", () => {
  async function criarIngresso(hash = "a".repeat(64)) {
    const lote = await saveLote({
      event_id: "ev1",
      name: "Lote",
      price: 30,
      quantity_total: 10,
      is_active: true,
    });
    const ts = new Date().toISOString();
    const ticket = {
      id: crypto.randomUUID(),
      tenant_id: null,
      order_id: crypto.randomUUID(),
      ticket_type_id: lote.id,
      customer_id: crypto.randomUUID(),
      qr_code_hash: hash,
      is_checked_in: false,
      checked_in_at: null,
      created_at: ts,
      updated_at: ts,
      sync_status: "synced" as const,
    };
    await db.tickets.put(ticket);
    return { lote, ticket };
  }

  it("encontra ingresso pelo hash do QR", async () => {
    const { ticket } = await criarIngresso();
    const achado = await getTicketByHash(ticket.qr_code_hash);
    expect(achado?.id).toBe(ticket.id);
    expect(await getTicketByHash("b".repeat(64))).toBeUndefined();
  });

  it("faz check-in local e enfileira uma única vez", async () => {
    const { ticket } = await criarIngresso();

    const r1 = await fazerCheckinTicket(ticket.id);
    expect(r1?.is_checked_in).toBe(true);
    expect(r1?.sync_status).toBe("pending");
    expect(await contagemCheckinsPendentes()).toBe(1);

    // Repetir não duplica a fila (idempotente).
    await fazerCheckinTicket(ticket.id);
    expect(await contagemCheckinsPendentes()).toBe(1);
  });

  it("não faz check-in de ingresso inexistente", async () => {
    expect(await fazerCheckinTicket("inexistente")).toBeNull();
  });

  it("soma apenas pedidos pagos no resumo de vendas", async () => {
    const ts = new Date().toISOString();
    const base = {
      tenant_id: null,
      event_id: "ev1",
      ticket_type_id: "lote1",
      customer_id: "p1",
      payment_method: "pix" as const,
      created_at: ts,
      updated_at: ts,
      sync_status: "synced" as const,
    };
    await db.orders.bulkPut([
      { ...base, id: "o1", quantity: 2, total_amount: 100, status: "paid" },
      { ...base, id: "o2", quantity: 1, total_amount: 50, status: "pending" },
      { ...base, id: "o3", quantity: 3, total_amount: 150, status: "paid" },
    ]);

    const resumo = await resumoVendas("ev1");
    expect(resumo.pedidosPagos).toBe(2);
    expect(resumo.ingressosVendidos).toBe(5);
    expect(resumo.receita).toBe(250);

    const outro = await resumoVendas("ev2");
    expect(outro.pedidosPagos).toBe(0);
  });
});
