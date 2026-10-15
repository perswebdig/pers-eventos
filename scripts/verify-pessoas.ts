import "fake-indexeddb/auto";
import { isValidCpf, formatCpf } from "../src/lib/cpf";
import { calcularIdade, ehMenor } from "../src/lib/format";
import { pessoaSchema, type PessoaFormValues } from "../src/features/pessoas/pessoa-schema";
import { db } from "../src/db/db";
import type { EventoLocal, InscricaoLocal } from "../src/db/types";
import {
  deletePessoa,
  filtrarPessoas,
  getPessoaDetalhe,
  listPessoas,
  savePessoa,
} from "../src/db/repos/pessoas";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FALHOU: ${msg}`);
  console.log(`OK  ${msg}`);
}

const base: PessoaFormValues = {
  nome_completo: "Fulano de Tal",
  cpf: "",
  rg: "",
  data_nascimento: "",
  telefone: "",
  email: "",
  endereco: "",
  contato_emergencia_nome: "",
  contato_emergencia_telefone: "",
  restricoes_alimentares: "",
  condicoes_saude: "",
  medicacoes: "",
  observacoes: "",
  consentimento_lgpd: true,
  responsavel_nome: "",
  responsavel_cpf: "",
};

function erros(values: Partial<PessoaFormValues>): string[] {
  const r = pessoaSchema.safeParse({ ...base, ...values });
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
}

async function main() {
  console.log("== CPF: dígito verificador ==");
  assert(isValidCpf("111.444.777-35"), "CPF válido aceito");
  assert(isValidCpf("52998224725"), "CPF válido sem máscara aceito");
  assert(!isValidCpf("111.111.111-11"), "CPF de dígitos repetidos rejeitado");
  assert(!isValidCpf("123.456.789-00"), "CPF com DV inválido rejeitado");
  assert(!isValidCpf("123"), "CPF curto rejeitado");
  assert(formatCpf("52998224725") === "529.982.247-25", "formatação de CPF");

  console.log("\n== idade / menor ==");
  const ano = new Date().getFullYear();
  assert(ehMenor(`${ano - 10}-01-01`), "10 anos é menor");
  assert(!ehMenor(`${ano - 30}-01-01`), "30 anos não é menor");
  assert(calcularIdade(`${ano - 30}-01-01`) === 30, "cálculo de idade");

  console.log("\n== schema: obrigatórios e condicionais ==");
  assert(erros({ nome_completo: "Ab" }).includes("nome_completo"), "nome curto inválido");
  assert(erros({ cpf: "123.456.789-00" }).includes("cpf"), "CPF inválido barra o cadastro");
  assert(erros({ email: "sem-arroba" }).includes("email"), "e-mail inválido barra");

  assert(
    erros({ consentimento_lgpd: false }).includes("consentimento_lgpd"),
    "LGPD obrigatório",
  );

  // Menor sem responsável → erro nos campos do responsável.
  const menorSemResp = erros({ data_nascimento: `${ano - 12}-06-01` });
  assert(
    menorSemResp.includes("responsavel_nome") && menorSemResp.includes("responsavel_cpf"),
    "menor exige dados do responsável",
  );

  // Menor com responsável válido → passa.
  assert(
    erros({
      data_nascimento: `${ano - 12}-06-01`,
      responsavel_nome: "Maria Responsável",
      responsavel_cpf: "529.982.247-25",
    }).length === 0,
    "menor com responsável válido é aceito",
  );

  // Adulto sem CPF → passa (CPF é opcional).
  assert(erros({ data_nascimento: `${ano - 40}-01-01` }).length === 0, "adulto sem CPF aceito");

  await testarRepositorio(ano);

  console.log("\nTODOS OS TESTES DE PESSOAS PASSARAM");
}

async function testarRepositorio(ano: number) {
  console.log("\n== repositório (Dexie offline) ==");
  await db.delete();
  await db.open();

  // A) cadastro de adulto: normaliza CPF/telefone e enfileira sync.
  const idAna = await savePessoa({
    ...base,
    nome_completo: "Ana Silva",
    cpf: "529.982.247-25",
    telefone: "(11) 98888-7777",
  });
  const ana = await db.pessoas.get(idAna);
  assert(ana?.cpf === "52998224725", "CPF salvo só com dígitos");
  assert(ana?.telefone === "11988887777", "telefone salvo só com dígitos");
  assert(ana?.sync_status === "pending", "nova pessoa marcada como pending");
  const filaAna = await db.sync_queue
    .where("[entidade+entidade_id]")
    .equals(["pessoas", idAna])
    .count();
  assert(filaAna === 1, "nova pessoa entra na fila de sync");

  // B) menor cria linha em `menores`; virar adulto remove.
  const idBia = await savePessoa({
    ...base,
    nome_completo: "Bia Menor",
    data_nascimento: `${ano - 12}-03-10`,
    responsavel_nome: "Mãe da Bia",
    responsavel_cpf: "529.982.247-25",
  });
  const detBia = await getPessoaDetalhe(idBia);
  assert(detBia?.menor?.responsavel_nome === "Mãe da Bia", "menor gera registro de responsável");

  await savePessoa(
    { ...base, nome_completo: "Bia Adulta", data_nascimento: `${ano - 30}-03-10` },
    idBia,
  );
  const menoresRestantes = await db.menores.where("pessoa_id").equals(idBia).count();
  assert(menoresRestantes === 0, "saída da menoridade remove o responsável");

  // C) edição preserva created_at e reabre o sync.
  const anaAntes = (await db.pessoas.get(idAna))!;
  await db.pessoas.update(idAna, { sync_status: "synced" });
  await savePessoa(
    {
      ...base,
      nome_completo: "Ana Silva Editada",
      cpf: "529.982.247-25",
      telefone: "(11) 98888-7777",
    },
    idAna,
  );
  const anaDepois = (await db.pessoas.get(idAna))!;
  assert(anaDepois.created_at === anaAntes.created_at, "edição preserva created_at");
  assert(anaDepois.nome_completo === "Ana Silva Editada", "edição aplica novos valores");
  assert(anaDepois.sync_status === "pending", "edição volta para pending");

  // D) histórico de eventos.
  const now = new Date().toISOString();
  const evento: EventoLocal = {
    id: "ev1",
    nome: "Retiro na Serra",
    descricao: null,
    data_inicio: `${ano}-07-01`,
    data_fim: null,
    local: null,
    capacidade: 20,
    status: "aberto",
    created_at: now,
    updated_at: now,
    sync_status: "synced",
  };
  const inscricao: InscricaoLocal = {
    id: "ins1",
    pessoa_id: idAna,
    evento_id: "ev1",
    status: "confirmado",
    data_checkin: null,
    data_checkout: null,
    pagamento_status: "pago",
    valor: null,
    forma_pagamento: null,
    termo_assinado: false,
    created_at: now,
    updated_at: now,
    sync_status: "synced",
  };
  await db.eventos.put(evento);
  await db.inscricoes.put(inscricao);
  const detAna = await getPessoaDetalhe(idAna);
  assert(detAna?.historico.length === 1, "histórico traz a inscrição");
  assert(detAna?.historico[0].evento?.nome === "Retiro na Serra", "histórico resolve o evento");

  // E) busca local.
  const todas = await listPessoas();
  assert(filtrarPessoas(todas, "ana").length === 1, "busca por nome");
  assert(filtrarPessoas(todas, "529.982.247-25").length === 1, "busca por CPF (com máscara)");
  assert(filtrarPessoas(todas, "1198888").length === 1, "busca por telefone");

  // F) exclusão remove pessoa e dependentes.
  await deletePessoa(idAna);
  assert((await db.pessoas.get(idAna)) === undefined, "exclusão remove a pessoa");
  assert(
    (await db.inscricoes.where("pessoa_id").equals(idAna).count()) === 0,
    "exclusão remove inscrições dependentes",
  );

  await db.delete();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
