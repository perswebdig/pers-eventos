import "fake-indexeddb/auto";
import { db } from "../src/db/db";
import type { PessoaLocal, EventoLocal, InscricaoLocal } from "../src/db/types";
import { eventoFormSchema, toEventoFormValues, type EventoFormValues } from "../src/features/eventos/evento-schema";
import { parseInscricaoQr, encodeInscricaoQr } from "../src/features/checkin/qr";
import {
  addInscricao,
  buscarInscricoes,
  fazerCheckin,
  fazerCheckout,
  getInscricaoDetalhe,
  listEventos,
  saveEvento,
} from "../src/db/repos/eventos";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FALHOU: ${msg}`);
  console.log(`OK  ${msg}`);
}

const baseEvento: EventoFormValues = {
  nome: "Retiro QR",
  descricao: "",
  data_inicio: "2026-07-10",
  data_fim: "",
  local: "Sítio QR",
  capacidade: "5",
  status: "planejado",
};

function pessoa(nome: string): PessoaLocal {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nome_completo: nome,
    cpf: null, rg: null, data_nascimento: null, telefone: null, email: null,
    endereco: null, contato_emergencia_nome: null, contato_emergencia_telefone: null,
    restricoes_alimentares: null, condicoes_saude: null, medicacoes: null,
    observacoes: null, consentimento_lgpd: true, created_at: ts, updated_at: ts, sync_status: "synced",
  };
}

async function main() {
  console.log("== QR payload encode/decode ==");
  const id = crypto.randomUUID();
  const payload = encodeInscricaoQr(id);
  assert(payload === `PERS1:${id}`, "encode prefix");
  assert(parseInscricaoQr(payload) === id, "decode with prefix");
  assert(parseInscricaoQr(id) === id, "decode raw uuid");
  assert(parseInscricaoQr("PERS1:invalid") === null, "reject bad prefix");
  assert(parseInscricaoQr("not-a-uuid") === null, "reject non-uuid");

  console.log("\n== repositório check-in/out ==");
  await db.delete();
  await db.open();

  const p1 = pessoa("João Silva");
  const p2 = pessoa("Maria Souza");
  await db.pessoas.bulkPut([p1, p2]);

  const evId = await saveEvento({ ...baseEvento, capacidade: "2" });
  const insId = await addInscricao(evId, { pessoa_id: p1.id, status: "confirmado", pagamento_status: "pago", valor: "", forma_pagamento: "" });
  await addInscricao(evId, { pessoa_id: p2.id, status: "inscrito", pagamento_status: "pendente", valor: "", forma_pagamento: "" });

  // A) check-in primeira vez
  const detCheckin = await fazerCheckin(insId);
  assert(detCheckin?.inscricao.status === "checkin", "status vira checkin");
  assert(detCheckin?.inscricao.data_checkin !== null, "data_checkin preenchida");
  assert(detCheckin?.inscricao.data_checkout === null, "data_checkout null");

  // B) check-out
  const detCheckout = await fazerCheckout(insId);
  assert(detCheckout?.inscricao.status === "checkout", "status vira checkout");
  assert(detCheckout?.inscricao.data_checkout !== null, "data_checkout preenchida");
  assert(detCheckout?.inscricao.data_checkin !== null, "data_checkin mantida");

  // C) nova entrada (após checkout) gera novo check-in com novo horário
  const antes = detCheckout!.inscricao.data_checkin;
  const detNovaEntrada = await fazerCheckin(insId);
  assert(detNovaEntrada?.inscricao.status === "checkin", "nova entrada vira checkin");
  assert(detNovaEntrada?.inscricao.data_checkout === null, "checkout limpo");
  assert(detNovaEntrada!.inscricao.data_checkin !== antes, "novo horário de check-in");

  // D) buscar por nome
  const res = await buscarInscricoes("joão");
  assert(res.length === 1 && res[0].pessoa?.nome_completo === "João Silva", "busca por nome");

  // E) buscar com filtro de evento
  const res2 = await buscarInscricoes("maria", evId);
  assert(res2.length === 1, "busca com filtro de evento");

  await db.delete();
  console.log("\nTODOS OS TESTES DE CHECK-IN PASSARAM");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});