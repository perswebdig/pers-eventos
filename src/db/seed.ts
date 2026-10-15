import { db } from "./db";
import type { EventoLocal, InscricaoLocal, PessoaLocal } from "./types";

const SEED_KEY = "seed_local_v1";

const nowIso = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

// Dados fake para validar o sync e a UI sem depender do Supabase.
// Todas as linhas entram como `pending` para que o sync worker as envie.
export async function seedLocalDatabase(force = false): Promise<number> {
  const marker = await db.meta.get(SEED_KEY);
  if (marker && !force) return 0;

  const pessoas: PessoaLocal[] = [
    ["Ana Beatriz Souza", "11111111111", "(31) 98888-0001", "1988-03-12"],
    ["Bruno Carvalho", "22222222222", "(31) 98888-0002", "1979-07-25"],
    ["Carla Menezes", "33333333333", "(21) 97777-0003", "1995-11-02"],
    ["Diego Ferreira", "44444444444", "(21) 97777-0004", "1990-01-18"],
    ["Elisa Rocha", "55555555555", "(11) 96666-0005", "1983-05-30"],
    ["Felipe Nunes", "66666666666", "(11) 96666-0006", "2007-09-14"],
    ["Gabriela Lima", "77777777777", "(71) 95555-0007", "1992-12-21"],
    ["Henrique Alves", "88888888888", "(71) 95555-0008", "1975-02-09"],
    ["Isabela Martins", "99999999999", "(31) 98888-0009", "1998-08-08"],
    ["João Pedro Ramos", "10101010101", "(31) 98888-0010", "1986-06-16"],
  ].map(([nome_completo, cpf, telefone, data_nascimento]) => {
    const ts = nowIso();
    return {
      id: uuid(),
      nome_completo,
      cpf,
      rg: null,
      data_nascimento,
      telefone,
      email: `${cpf}@exemplo.com`,
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
      sync_status: "pending" as const,
    };
  });

  const eventos: EventoLocal[] = [
    {
      id: uuid(),
      nome: "Retiro de Outono",
      descricao: "Fim de semana de meditação e trilhas na mata.",
      data_inicio: new Date(Date.now() + 20 * 864e5).toISOString(),
      data_fim: new Date(Date.now() + 22 * 864e5).toISOString(),
      local: "Sítio Vale Verde",
      capacidade: 30,
      status: "planejado",
      created_at: nowIso(),
      updated_at: nowIso(),
      sync_status: "pending",
    },
    {
      id: uuid(),
      nome: "Vivência de Primavera",
      descricao: "Imersão de um dia com yoga e banho de floresta.",
      data_inicio: new Date(Date.now() + 45 * 864e5).toISOString(),
      data_fim: null,
      local: "Fazenda Serra Azul",
      capacidade: 50,
      status: "planejado",
      created_at: nowIso(),
      updated_at: nowIso(),
      sync_status: "pending",
    },
  ];

  const inscricoes: InscricaoLocal[] = pessoas.slice(0, 5).map((p, i) => ({
    id: uuid(),
    pessoa_id: p.id,
    evento_id: eventos[i % 2].id,
    status: "inscrito",
    data_checkin: null,
    data_checkout: null,
    pagamento_status: "pendente",
    valor: 180,
    forma_pagamento: null,
    termo_assinado: false,
    created_at: nowIso(),
    updated_at: nowIso(),
    sync_status: "pending",
  }));

  await db.transaction("rw", [db.pessoas, db.eventos, db.inscricoes, db.meta], async () => {
    await db.pessoas.bulkPut(pessoas);
    await db.eventos.bulkPut(eventos);
    await db.inscricoes.bulkPut(inscricoes);
    await db.meta.put({ key: SEED_KEY, value: { at: nowIso(), count: pessoas.length } });
  });

  return pessoas.length;
}

export async function clearLocalDatabase(): Promise<void> {
  await db.transaction(
    "rw",
    [db.pessoas, db.menores, db.eventos, db.inscricoes, db.documentos, db.termos, db.arquivos, db.sync_queue, db.sync_cursor, db.meta],
    async () => {
      await Promise.all([
        db.pessoas.clear(),
        db.menores.clear(),
        db.eventos.clear(),
        db.inscricoes.clear(),
        db.documentos.clear(),
        db.termos.clear(),
        db.arquivos.clear(),
        db.sync_queue.clear(),
        db.sync_cursor.clear(),
        db.meta.clear(),
      ]);
    },
  );
}
