import "fake-indexeddb/auto";
import { db } from "../src/db/db";
import type { PessoaLocal } from "../src/db/types";
import {
  eventoFormSchema,
  toEventoFormValues,
  type EventoFormValues,
} from "../src/features/eventos/evento-schema";
import {
  addInscricao,
  countInscritos,
  deleteEvento,
  filtrarEventos,
  getEvento,
  getEventoDetalhe,
  inscricoesPorEvento,
  listEventos,
  listPessoasDisponiveis,
  removeInscricao,
  saveEvento,
  updateInscricao,
} from "../src/db/repos/eventos";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FALHOU: ${msg}`);
  console.log(`OK  ${msg}`);
}

const baseEvento: EventoFormValues = {
  nome: "Retiro de Teste",
  descricao: "",
  data_inicio: "2026-07-01",
  data_fim: "",
  local: "Sítio Teste",
  capacidade: "",
  status: "planejado",
};

function erros(values: Partial<EventoFormValues>): string[] {
  const r = eventoFormSchema.safeParse({ ...baseEvento, ...values });
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
}

function pessoa(nome: string): PessoaLocal {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nome_completo: nome,
    cpf: null,
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
}

async function main() {
  console.log("== schema de evento ==");
  assert(erros({ nome: "Ab" }).includes("nome"), "nome curto inválido");
  assert(erros({ data_inicio: "" }).includes("data_inicio"), "início obrigatório");
  assert(
    erros({ data_inicio: "2026-07-10", data_fim: "2026-07-01" }).includes("data_fim"),
    "término antes do início é rejeitado",
  );
  assert(
    erros({ data_inicio: "2026-07-01", data_fim: "2026-07-05" }).length === 0,
    "intervalo válido aceito",
  );
  assert(erros({ capacidade: "-1" }).includes("capacidade"), "vagas negativas rejeitadas");
  assert(erros({ capacidade: "2,5" }).includes("capacidade"), "vagas não inteiras rejeitadas");
  assert(erros({ capacidade: "30" }).length === 0, "vagas válidas aceitas");
  assert(toEventoFormValues({ status: null }).status === "planejado", "status padrão");

  console.log("\n== repositório (Dexie offline) ==");
  await db.delete();
  await db.open();

  const ana = pessoa("Ana Souza");
  const bruno = pessoa("Bruno Lima");
  await db.pessoas.bulkPut([ana, bruno]);

  // A) criação de evento.
  const evId = await saveEvento({
    ...baseEvento,
    nome: "Retiro de Inverno",
    capacidade: "10",
    local: "Sítio Teste",
  });
  const ev = await getEvento(evId);
  assert(ev?.capacidade === 10, "capacidade salva como número");
  assert(ev?.sync_status === "pending", "evento novo marcado como pending");
  const filaEv = await db.sync_queue
    .where("[entidade+entidade_id]")
    .equals(["eventos", evId])
    .count();
  assert(filaEv === 1, "evento entra na fila de sync");

  // B) inscrições.
  const disponiveisInicial = await listPessoasDisponiveis(evId);
  assert(disponiveisInicial.length === 2, "duas pessoas disponíveis no início");
  const insId = await addInscricao(evId, {
    pessoa_id: ana.id,
    status: "confirmado",
    pagamento_status: "pago",
    valor: "180,50",
    forma_pagamento: "pix",
  });
  assert((await countInscritos(evId)) === 1, "inscrição conta no evento");
  const det = await getEventoDetalhe(evId);
  assert(det?.inscritos[0].pessoa?.nome_completo === "Ana Souza", "inscrito resolve a pessoa");
  assert(det?.inscritos[0].inscricao.valor === 180.5, "valor convertido para número");
  assert((await listPessoasDisponiveis(evId)).length === 1, "Ana sai da lista de disponíveis");

  // C) duplicidade barrada.
  let duplicou = false;
  try {
    await addInscricao(evId, {
      pessoa_id: ana.id,
      status: "inscrito",
      pagamento_status: "pendente",
      valor: "",
      forma_pagamento: "",
    });
  } catch {
    duplicou = true;
  }
  assert(duplicou, "não permite inscrever a mesma pessoa duas vezes");

  // D) atualização de status da inscrição.
  await updateInscricao(insId, { status: "checkin" });
  const detCheckin = await getEventoDetalhe(evId);
  assert(detCheckin?.inscritos[0].inscricao.status === "checkin", "status da inscrição atualiza");

  // E) mapa de contagem.
  const mapa = await inscricoesPorEvento();
  assert(mapa.get(evId) === 1, "contagem por evento");

  // F) busca.
  const eventos = await listEventos();
  assert(filtrarEventos(eventos, "inverno").length === 1, "busca por nome");
  assert(filtrarEventos(eventos, "sítio").length === 1, "busca por local");
  assert(filtrarEventos(eventos, "planejado").length === 1, "busca por status");

  // G) edição preserva created_at.
  const antes = (await getEvento(evId))!;
  await saveEvento({ ...toEventoFormValues(antes), nome: "Retiro Editado" }, evId);
  const depois = (await getEvento(evId))!;
  assert(depois.created_at === antes.created_at, "edição preserva created_at");
  assert(depois.nome === "Retiro Editado", "edição aplica novos valores");

  // H) excluir inscrição.
  await removeInscricao(insId);
  assert((await countInscritos(evId)) === 0, "inscrição removida");

  // I) excluir evento remove inscrições dependentes.
  await addInscricao(evId, {
    pessoa_id: bruno.id,
    status: "inscrito",
    pagamento_status: "pendente",
    valor: "",
    forma_pagamento: "",
  });
  await deleteEvento(evId);
  assert((await getEvento(evId)) === undefined, "evento removido");
  assert(
    (await db.inscricoes.where("evento_id").equals(evId).count()) === 0,
    "exclusão remove inscrições dependentes",
  );

  await db.delete();
  console.log("\nTODOS OS TESTES DE EVENTOS PASSARAM");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
