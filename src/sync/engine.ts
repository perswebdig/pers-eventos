import type { Table } from "dexie";
import type { PersEventosDB } from "@/db/db";
import { ENTIDADES, ENTIDADES_PULL, type EntidadeSync, type SyncQueueItem } from "@/db/types";

type Row = Record<string, unknown>;

// Transporte abstraído para permitir testes com um servidor fake.
export interface SyncTransport {
  upsert(entidade: EntidadeSync, row: Row): Promise<Row | null>;
  update(entidade: EntidadeSync, id: string, row: Row): Promise<Row | null>;
  remove(entidade: EntidadeSync, id: string): Promise<void>;
  fetchSince(entidade: EntidadeSync, since: string | null, limit: number): Promise<Row[]>;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: number;
}

const BATCH = 500;

function entityTable(db: PersEventosDB, entidade: EntidadeSync): Table<Row, string> {
  return db.table(entidade) as unknown as Table<Row, string>;
}

// Erros transitórios (rede) abortam o ciclo para tentar depois; o item fica na fila.
export function isRetryable(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true;
  const e = err as { status?: number; message?: string; code?: string };
  if (typeof e?.status === "number" && e.status >= 500) return true;
  if (typeof e?.message === "string" && /fetch|network|timeout|load failed|failed to fetch/i.test(e.message)) {
    return true;
  }
  return false;
}

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

export async function pushChanges(
  db: PersEventosDB,
  transport: SyncTransport,
  result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: 0 },
): Promise<SyncResult> {
  const itens = await db.sync_queue.orderBy("created_at").toArray();

  // Garante que dependências de FK cheguem primeiro (ex.: pessoas antes de inscrições).
  const ordemEntidade = new Map(ENTIDADES.map((e, i) => [e, i]));
  itens.sort((a, b) => {
    const oa = ordemEntidade.get(a.entidade as EntidadeSync) ?? 0;
    const ob = ordemEntidade.get(b.entidade as EntidadeSync) ?? 0;
    return oa - ob || a.created_at.localeCompare(b.created_at);
  });

  for (const item of itens) {
    const entidade = item.entidade as EntidadeSync;
    try {
      let serverRow: Row | null = null;
      if (item.operacao === "delete") {
        await transport.remove(entidade, item.entidade_id);
      } else if (item.operacao === "insert") {
        serverRow = await transport.upsert(entidade, item.payload ?? {});
      } else {
        serverRow = await transport.update(entidade, item.entidade_id, item.payload ?? {});
      }

      // Só remove a linha da fila se ela não foi alterada durante o envio.
      const atual = await db.sync_queue.get(item.id as number);
      const inalterado =
        atual &&
        atual.operacao === item.operacao &&
        JSON.stringify(atual.payload) === JSON.stringify(item.payload);

      if (inalterado) {
        await db.sync_queue.delete(item.id as number);
        const restantes = await db.sync_queue
          .where("[entidade+entidade_id]")
          .equals([entidade, item.entidade_id])
          .count();
        if (restantes === 0 && serverRow) {
          await entityTable(db, entidade).put({ ...serverRow, sync_status: "synced" });
        }
      }
      result.pushed += 1;
    } catch (err) {
      if (isRetryable(err)) throw err; // aborta o lote (provavelmente offline)
      await markItemError(db, item, entidade, err);
      result.errors += 1;
    }
  }
  return result;
}

async function markItemError(
  db: PersEventosDB,
  item: SyncQueueItem,
  entidade: EntidadeSync,
  err: unknown,
): Promise<void> {
  const msg = errorMessage(err);
  await db.sync_queue.update(item.id as number, {
    tentativas: item.tentativas + 1,
    ultimo_erro: msg,
  });
  await entityTable(db, entidade).update(item.entidade_id, {
    sync_status: "error",
    sync_error: msg,
  });
}

type ApplyOutcome = "applied" | "skipped" | "conflict";

// Aplica uma linha remota, respeitando alterações locais pendentes.
async function applyRemoteRow(
  db: PersEventosDB,
  entidade: EntidadeSync,
  remote: Row,
): Promise<ApplyOutcome> {
  const id = remote.id as string;
  const table = entityTable(db, entidade);
  const local = await table.get(id);
  const pendentes = await db.sync_queue
    .where("[entidade+entidade_id]")
    .equals([entidade, id])
    .count();

  if (pendentes > 0) {
    // Regra de ouro: pendente local NUNCA é sobrescrito pelo remoto.
    if (local && String(remote.updated_at) > String(local.updated_at)) {
      await table.update(id, { sync_status: "conflict" });
      return "conflict";
    }
    return "skipped";
  }

  await table.put({ ...remote, sync_status: "synced" });
  return "applied";
}

export async function pullChanges(
  db: PersEventosDB,
  transport: SyncTransport,
  result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: 0 },
): Promise<SyncResult> {
  for (const entidade of ENTIDADES_PULL) {
    const cursor = await db.sync_cursor.get(entidade);
    let since: string | null = cursor?.ultima_sincronizacao ?? null;
    let maxVisto = since;

    // Busca em lotes até esgotar.
    for (;;) {
      const rows = await transport.fetchSince(entidade, since, BATCH);
      if (rows.length === 0) break;

      for (const remote of rows) {
        const outcome = await applyRemoteRow(db, entidade, remote);
        if (outcome === "applied") result.pulled += 1;
        else if (outcome === "conflict") result.conflicts += 1;
      }

      maxVisto = String(rows[rows.length - 1].updated_at);
      since = maxVisto;
      if (rows.length < BATCH) break;
    }

    if (maxVisto && maxVisto !== cursor?.ultima_sincronizacao) {
      await db.sync_cursor.put({ tabela: entidade, ultima_sincronizacao: maxVisto });
    }
  }
  return result;
}

// Ciclo completo: envia pendentes e depois baixa novidades.
export async function runSync(
  db: PersEventosDB,
  transport: SyncTransport,
): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, conflicts: 0, errors: 0 };
  await pushChanges(db, transport, result);
  await pullChanges(db, transport, result);
  return result;
}
