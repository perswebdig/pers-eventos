import type { Table } from "dexie";
import type { PersEventosDB } from "./db";
import type { EntidadeSync, OperacaoSync } from "./types";

type Row = Record<string, unknown>;

const nowIso = () => new Date().toISOString();

function entityTable(db: PersEventosDB, entidade: EntidadeSync): Table<Row, string> {
  return db.table(entidade) as unknown as Table<Row, string>;
}

// Remove campos que só existem no banco local antes de enviar ao servidor.
export function toServerPayload(record: Row): Row {
  const copy = { ...record };
  delete copy.sync_status;
  delete copy.sync_error;
  return copy;
}

// Mantém no máximo UMA operação por registro na fila (colapsa edições).
export async function enqueue(
  db: PersEventosDB,
  entidade: EntidadeSync,
  entidadeId: string,
  operacao: OperacaoSync,
  payload: Row | null,
): Promise<void> {
  const existentes = await db.sync_queue
    .where("[entidade+entidade_id]")
    .equals([entidade, entidadeId])
    .toArray();

  const ids = existentes.map((e) => e.id).filter((id): id is number => typeof id === "number");

  if (operacao === "delete") {
    // Se o registro nunca foi enviado, basta sumir com a fila (nada no servidor).
    if (ids.length) await db.sync_queue.bulkDelete(ids);
    if (existentes.some((e) => e.operacao === "insert")) return;
    await db.sync_queue.add({
      entidade,
      entidade_id: entidadeId,
      operacao: "delete",
      payload: null,
      tentativas: 0,
      created_at: nowIso(),
    });
    return;
  }

  const atual = existentes[0];
  if (atual) {
    // `insert` tem prioridade: nunca rebaixar para `update`.
    const op: OperacaoSync = atual.operacao === "insert" ? "insert" : operacao;
    await db.sync_queue.update(atual.id as number, {
      operacao: op,
      payload,
      tentativas: 0,
      ultimo_erro: undefined,
    });
  } else {
    await db.sync_queue.add({
      entidade,
      entidade_id: entidadeId,
      operacao,
      payload,
      tentativas: 0,
      created_at: nowIso(),
    });
  }
}

// Grava localmente com status `pending` e enfileira o envio.
export async function saveLocal<T extends { id: string }>(
  db: PersEventosDB,
  entidade: EntidadeSync,
  data: T,
): Promise<T & { sync_status: "pending"; updated_at: string }> {
  const table = entityTable(db, entidade);
  const id = data.id;
  const existente = await table.get(id);
  const record = {
    ...data,
    updated_at: nowIso(),
    sync_status: "pending" as const,
  };
  await table.put(record);
  await enqueue(db, entidade, id, existente ? "update" : "insert", toServerPayload(record as Row));
  return record;
}

// Remove localmente e enfileira a exclusão.
export async function deleteLocal(
  db: PersEventosDB,
  entidade: EntidadeSync,
  entidadeId: string,
): Promise<void> {
  await entityTable(db, entidade).delete(entidadeId);
  await enqueue(db, entidade, entidadeId, "delete", null);
}
