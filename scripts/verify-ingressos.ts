import "fake-indexeddb/auto";
import { db } from "../src/db/db";
import type { OrderLocal, TicketLocal } from "../src/db/types";
import { saveLote, listLotesByEvento, removeLote, loteDisponivel } from "../src/db/repos/lotes";
import {
  fazerCheckinTicket,
  getTicketByHash,
  getTicketDetalhe,
  resumoVendas,
  contagemCheckinsPendentes,
} from "../src/db/repos/ingressos";
import { flushCheckinQueue } from "../src/sync/checkin-queue";
import { encodeIngressoQr, parseIngressoQr } from "../src/features/checkin/qr";
import type { PessoaLocal } from "../src/db/types";

// Fluxo completo offline da Fase 2 (lotes → pedido pago → ingressos →
// check-in local → fila de sincronização → flush). Rode com:
//   npm run ingressos:verify
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FALHOU: ${msg}`);
}

async function main() {
  // O repositório usa a instância singleton `db`; o verify trabalha nela.
  await db.delete();
  await db.open();

  for (const t of ["ticket_types", "orders", "tickets", "checkin_queue"]) {
    assert(
      db.tables.some((x) => x.name === t),
      `tabela "${t}" existe`,
    );
  }
  console.log("OK  tabelas da Fase 2 criadas");

  const ts = new Date().toISOString();

  // Evento e pessoa locais mínimos.
  await db.eventos.put({
    id: "ev1",
    nome: "Festival Offline",
    descricao: null,
    data_inicio: "2026-12-01",
    data_fim: null,
    local: "Quadra 1",
    capacidade: 100,
    status: "aberto",
    created_at: ts,
    updated_at: ts,
    sync_status: "synced",
  });
  const pessoa: PessoaLocal = {
    id: "pes1",
    tenant_id: null,
    nome_completo: "Cliente Teste",
    cpf: "00000000000",
    rg: null,
    data_nascimento: null,
    telefone: null,
    email: null,
    endereco: null,
    contato_emergencia_nome: null,
    contato_emergencia_telefone: null,
    restricoes_alimentares: null,
    condicoes_saude: null,
    medicacoes: null,
    observacoes: null,
    consentimento_lgpd: true,
    created_at: ts,
    updated_at: ts,
    sync_status: "synced",
  };
  await db.pessoas.put(pessoa);

  // Lote criado offline (pendente de sincronização).
  const lote = await saveLote({
    event_id: "ev1",
    name: "1º Lote",
    price: 75.5,
    quantity_total: 50,
    is_active: true,
  });
  assert(lote.sync_status === "pending", "lote criado como pendente");
  assert(loteDisponivel(lote) === 50, "50 disponíveis");
  assert((await listLotesByEvento("ev1")).length === 1, "lote listado");
  assert(
    (await db.sync_queue
      .where("[entidade+entidade_id]")
      .equals(["ticket_types", lote.id])
      .count()) === 1,
    "lote enfileirado para envio",
  );
  console.log("OK  lote offline criado e enfileirado");

  // Pedido pago (chega pelo pull do servidor) com 2 ingressos.
  const order: OrderLocal = {
    id: "ord1",
    tenant_id: null,
    customer_id: pessoa.id,
    event_id: "ev1",
    ticket_type_id: lote.id,
    quantity: 2,
    total_amount: 151,
    status: "paid",
    payment_method: "pix",
    created_at: ts,
    updated_at: ts,
    sync_status: "synced",
  };
  await db.orders.put(order);
  await db.ticket_types.update(lote.id, { quantity_sold: 2 });

  const hash1 = "1".repeat(64);
  const hash2 = "2".repeat(64);
  const ticketBase = {
    tenant_id: null,
    order_id: order.id,
    ticket_type_id: lote.id,
    customer_id: pessoa.id,
    is_checked_in: false,
    checked_in_at: null,
    created_at: ts,
    updated_at: ts,
    sync_status: "synced" as const,
  };
  const ticket1: TicketLocal = { ...ticketBase, id: "tkt1", qr_code_hash: hash1 };
  const ticket2: TicketLocal = { ...ticketBase, id: "tkt2", qr_code_hash: hash2 };
  await db.tickets.bulkPut([ticket1, ticket2]);

  const resumo = await resumoVendas("ev1");
  assert(resumo.ingressosVendidos === 2, "2 ingressos vendidos");
  assert(resumo.receita === 151, "receita 151");
  console.log("OK  pedido pago e ingressos presentes");

  // QR "PERS2:<hash>" roundtrip.
  const payload = encodeIngressoQr(hash1);
  assert(payload === `PERS2:${hash1}`, "encode do QR de ingresso");
  assert(parseIngressoQr(payload) === hash1, "parse do QR de ingresso");
  assert(parseIngressoQr(hash1) === hash1, "parse aceita hash puro");
  console.log("OK  QR de ingresso PERS2");

  // Check-in offline.
  const porHash = await getTicketByHash(hash1);
  assert(porHash?.id === "tkt1", "busca por hash do QR");
  const det = await getTicketDetalhe(porHash!);
  assert(det.pessoa?.nome_completo === "Cliente Teste", "detalhe traz a pessoa");
  assert(det.eventoNome === "Festival Offline", "detalhe traz o evento");

  const checkin = await fazerCheckinTicket("tkt1");
  assert(checkin?.is_checked_in === true, "check-in marcado");
  assert(checkin?.sync_status === "pending", "check-in pendente de sync");
  await fazerCheckinTicket("tkt1"); // idempotente
  assert((await contagemCheckinsPendentes()) === 1, "fila com 1 check-in");
  console.log("OK  check-in offline enfileirado (idempotente)");

  // Flush da fila (fetch simulado: servidor aceitou).
  let corpoEnviado: unknown = null;
  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    corpoEnviado = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ data: { processed: 1, already: 0, not_found: [] } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  const flush = await flushCheckinQueue();
  assert(flush?.enviados === 1, "flush enviou 1 check-in");
  assert((await contagemCheckinsPendentes()) === 0, "fila esvaziada após flush");
  const aposFlush = await db.tickets.get("tkt1");
  assert(aposFlush?.sync_status === "synced", "ingresso marcado como sincronizado");
  const enviado = corpoEnviado as { checkins: { qr_code_hash: string }[] };
  assert(enviado.checkins[0].qr_code_hash === hash1, "hash correto no payload");
  console.log("OK  flush da fila de check-in");

  // Exclusão de lote sem vendas e bloqueio com vendas.
  const loteVazio = await saveLote({
    event_id: "ev1",
    name: "Lote vazio",
    price: 0,
    quantity_total: 5,
    is_active: true,
  });
  await removeLote(loteVazio.id);
  assert((await listLotesByEvento("ev1")).length === 1, "lote sem vendas excluído");

  let bloqueou = false;
  try {
    await removeLote(lote.id);
  } catch {
    bloqueou = true;
  }
  assert(bloqueou, "lote com vendas não pode ser excluído");
  console.log("OK  regras de exclusão de lotes");

  await db.delete();
  console.log("\nTudo certo! Fluxo offline de ingressos verificado.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
