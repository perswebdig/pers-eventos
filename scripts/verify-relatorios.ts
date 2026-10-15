import "fake-indexeddb/auto";
import { db } from "../src/db/db";
import {
  getPessoasResumo,
  getEventosResumo,
  getInscricoesResumo,
  getTermosResumo,
  getLogsAcessoResumo,
  getCheckinsPorDia,
  exportarPessoasCSV,
  exportarEventosCSV,
  exportarInscricoesCSV,
  exportarTermosCSV,
  exportarLogsAcessoCSV,
  toCSV,
} from "../src/db/repos/relatorios";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FALHOU: ${msg}`);
  console.log(`OK  ${msg}`);
}

function pessoa(nome: string, opts: { cpf?: boolean; menor?: boolean; lgpd?: boolean } = {}) {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nome_completo: nome,
    cpf: opts.cpf ? "12345678901" : null,
    rg: null, data_nascimento: opts.menor ? "2015-01-01" : "1990-01-01", telefone: null,
    email: null, endereco: null, contato_emergencia_nome: null, contato_emergencia_telefone: null,
    restricoes_alimentares: null, condicoes_saude: null, medicacoes: null, observacoes: null,
    consentimento_lgpd: opts.lgpd ?? true, created_at: ts, updated_at: ts, sync_status: "synced" as const,
  };
}

function evento(nome: string, capacidade = 10, status = "planejado") {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(), nome, descricao: null, data_inicio: "2026-07-01", data_fim: null,
    local: "Local", capacidade, status, created_at: ts, updated_at: ts, sync_status: "synced" as const,
  };
}

function inscricao(pessoaId: string, eventoId: string, status = "inscrito") {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(), pessoa_id: pessoaId, evento_id: eventoId, status,
    data_checkin: status === "checkin" || status === "checkout" ? new Date().toISOString() : null,
    data_checkout: status === "checkout" ? new Date().toISOString() : null,
    pagamento_status: "pendente", valor: 100, forma_pagamento: null, termo_assinado: false,
    created_at: ts, updated_at: ts, sync_status: "synced" as const,
  };
}

async function main() {
  console.log("== toCSV helper ==");
  assert(toCSV([{ a: 1, b: "x" }, { a: 2, b: "y" }]).split("\n").length === 3, "header + 2 rows");
  assert(toCSV([{ a: 'com"virgula', b: 1 }]).includes('"com""virgula"'), "escapa aspas");
  assert(toCSV([]) === "", "array vazio");

  console.log("\n== Repositório relatórios ==");
  await db.delete();
  await db.open();

  const p1 = pessoa("Ana", { cpf: true, lgpd: true });
  const p2 = pessoa("Bruno", { cpf: false, menor: true, lgpd: true });
  const p3 = pessoa("Carlos", { cpf: true, lgpd: false });
  await db.pessoas.bulkPut([p1, p2, p3]);
  await db.menores.put({
    id: crypto.randomUUID(), pessoa_id: p2.id, responsavel_nome: "Responsável", responsavel_cpf: "12345678901",
    autorizacao_url: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: "synced",
  });

  const e1 = evento("Evento A", 20, "aberto");
  const e2 = evento("Evento B", 10, "planejado");
  await db.eventos.bulkPut([e1, e2]);

  await db.inscricoes.bulkPut([
    inscricao(p1.id, e1.id, "confirmado"),
    inscricao(p2.id, e1.id, "checkin"),
    inscricao(p3.id, e1.id, "checkout"),
    inscricao(p1.id, e2.id, "inscrito"),
  ]);

  await db.termos.put({
    id: crypto.randomUUID(), pessoa_id: p1.id, evento_id: e1.id, tipo: "responsabilidade",
    aceito_em: new Date().toISOString(), ip: null, assinatura_url: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: "synced",
  });
  await db.termos.put({
    id: crypto.randomUUID(), pessoa_id: p2.id, evento_id: null, tipo: "imagem",
    aceito_em: new Date().toISOString(), ip: null, assinatura_url: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), sync_status: "synced",
  });

  await db.log_acesso_dados.bulkAdd([
    { user_id: "u1", pessoa_id: p1.id, acao: "visualizou_assinatura", criado_em: new Date().toISOString(), sync_status: "synced" },
    { user_id: "u1", pessoa_id: p1.id, acao: "visualizou_assinatura", criado_em: new Date().toISOString(), sync_status: "synced" },
    { user_id: "u2", pessoa_id: p2.id, acao: "baixou_assinatura", criado_em: new Date().toISOString(), sync_status: "synced" },
  ]);

  // A) Resumos
  const pr = await getPessoasResumo();
  assert(pr.total === 3, "pessoas total");
  assert(pr.comCpf === 2, "pessoas com CPF");
  assert(pr.menores === 1, "menores");
  assert(pr.consentimentoLgpd === 2, "lgpd");

  const er = await getEventosResumo();
  assert(er.total === 2, "eventos total");
  assert(er.capacidadeTotal === 30, "capacidade total");
  assert(er.vagasPreenchidas === 4, "vagas preenchidas");

  const ir = await getInscricoesResumo();
  assert(ir.total === 4, "inscrições total");
  assert(ir.checkinsRealizados === 2, "checkins");
  assert(ir.checkoutsRealizados === 1, "checkouts");

  const tr = await getTermosResumo();
  assert(tr.total === 2, "termos total");
  assert(tr.porTipo.responsabilidade === 1, "resp");
  assert(tr.porTipo.imagem === 1, "imagem");

  const lr = await getLogsAcessoResumo();
  console.log("DEBUG logs total:", lr.total, lr.porAcao);
  assert(lr.total === 3, "logs total");
  assert(lr.porAcao.visualizou_assinatura === 2, "visualizou");
  assert(lr.porAcao.baixou_assinatura === 1, "baixou");

  // B) Check-ins por dia
  const cp = await getCheckinsPorDia(30);
  assert(cp.length > 0, "checkins por dia");
  const hoje = new Date().toISOString().slice(0, 10);
  const hojeEntry = cp.find((d) => d.data === hoje);
  assert(hojeEntry?.checkins === 2, "checkins hoje");
  assert(hojeEntry?.checkouts === 1, "checkout hoje");

  // C) CSVs
  const csvP = await exportarPessoasCSV();
  assert(csvP.split("\n").length === 4, "csv pessoas lines (header + 3)");
  assert(csvP.includes("Ana"), "csv contém nome");

  const csvE = await exportarEventosCSV();
  assert(csvE.includes("Evento A"), "csv eventos");

  const csvI = await exportarInscricoesCSV();
  assert(csvI.includes("confirmado"), "csv inscrições");

  const csvT = await exportarTermosCSV();
  assert(csvT.includes("responsabilidade"), "csv termos");

  const csvL = await exportarLogsAcessoCSV();
  assert(csvL.includes("visualizou_assinatura"), "csv logs");

  await db.delete();
  console.log("\nTODOS OS TESTES DE RELATÓRIOS PASSARAM");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});