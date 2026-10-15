import "fake-indexeddb/auto";
import { PersEventosDB } from "../src/db/db";
import { saveLocal, deleteLocal } from "../src/db/queue";
import type { EntidadeSync } from "../src/db/types";
import {
  pushChanges,
  pullChanges,
  runSync,
  type SyncTransport,
} from "../src/sync/engine";

type Row = Record<string, unknown>;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FALHOU: ${msg}`);
  console.log(`OK  ${msg}`);
}

// Servidor fake em memória (simula a tabela Postgres + trigger de updated_at).
class FakeServer implements SyncTransport {
  private tables = new Map<EntidadeSync, Map<string, Row>>();
  private last = 0;

  private table(t: EntidadeSync) {
    if (!this.tables.has(t)) this.tables.set(t, new Map());
    return this.tables.get(t)!;
  }
  private stamp() {
    this.last = Math.max(Date.now(), this.last + 1);
    return new Date(this.last).toISOString();
  }
  async upsert(t: EntidadeSync, row: Row) {
    const r = { ...row, updated_at: this.stamp() };
    this.table(t).set(String(row.id), r);
    return r;
  }
  async update(t: EntidadeSync, id: string, row: Row) {
    const prev = this.table(t).get(id) ?? { id };
    const r = { ...prev, ...row, updated_at: this.stamp() };
    this.table(t).set(id, r);
    return r;
  }
  async remove(t: EntidadeSync, id: string) {
    this.table(t).delete(id);
  }
  async fetchSince(t: EntidadeSync, since: string | null, limit: number) {
    return [...this.table(t).values()]
      .filter((r) => !since || String(r.updated_at) > since)
      .sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)))
      .slice(0, limit);
  }
  // helper de teste: escreve direto no "servidor" como se fosse outro aparelho
  write(t: EntidadeSync, row: Row) {
    this.table(t).set(String(row.id), { ...row, updated_at: this.stamp() });
  }
}

const pessoa = (id: string, nome: string): Row => ({
  id,
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
});

const ts = () => new Date().toISOString();

async function main() {
  const db = new PersEventosDB("pers-eventos-sync-verify");
  await db.delete();
  await db.open();
  const server = new FakeServer();

  // -------------------------------------------------------------------------
  console.log("\n== A) push de insert offline ==");
  await saveLocal(db, "pessoas", pessoa("p1", "Ana Local") as never);
  assert((await db.sync_queue.count()) === 1, "insert entra na fila");
  const r1 = await runSync(db, server);
  assert(r1.pushed === 1, "1 item enviado");
  const p1 = await db.pessoas.get("p1");
  assert(!!p1, "p1 existe localmente");
  assert(p1?.sync_status === "synced", "p1 marcado como synced");
  assert((await db.sync_queue.count()) === 0, "fila esvaziada após push");
  assert((await server.fetchSince("pessoas", null, 10)).length === 1, "servidor tem p1");

  // -------------------------------------------------------------------------
  console.log("\n== B) pull de novidade remota ==");
  server.write("pessoas", pessoa("p2", "Bruno Remoto") as Row);
  const r2 = await pullChanges(db, server);
  assert(r2.pulled >= 1, "pull aplicou novidade");
  const p2 = await db.pessoas.get("p2");
  assert(p2?.nome_completo === "Bruno Remoto", "p2 baixado do servidor");
  assert(p2?.sync_status === "synced", "p2 synced");

  // -------------------------------------------------------------------------
  console.log("\n== C) pendente local NUNCA é sobrescrito pelo remoto ==");
  // Edição local pendente:
  await saveLocal(
    db,
    "pessoas",
    { ...(p1 as unknown as Row), nome_completo: "Ana Editada Offline" } as never,
  );
  // Outro aparelho atualiza o mesmo registro (updated_at mais novo, sem push):
  server.write("pessoas", { ...pessoa("p1", "Ana Remota"), cpf: null } as Row);
  const r3 = await pullChanges(db, server); // pull sem push
  const p1b = await db.pessoas.get("p1");
  assert(p1b?.nome_completo === "Ana Editada Offline", "valor local preservado");
  assert(r3.conflicts >= 1, "conflito sinalizado");
  assert(p1b?.sync_status === "conflict", "status = conflict");

  // push resolve: last-write-wins local.
  await pushChanges(db, server);
  const p1c = await db.pessoas.get("p1");
  assert(p1c?.nome_completo === "Ana Editada Offline", "local vence no push");
  assert(p1c?.sync_status === "synced", "volta para synced");
  const servidorP1 = (await server.fetchSince("pessoas", null, 10)).find((x) => x.id === "p1");
  assert(servidorP1?.nome_completo === "Ana Editada Offline", "servidor recebeu valor local");

  // -------------------------------------------------------------------------
  console.log("\n== D) insert seguido de delete (nunca enviado) colapsa ==");
  await saveLocal(db, "pessoas", pessoa("p3", "Temp") as never);
  await deleteLocal(db, "pessoas", "p3");
  assert((await db.pessoas.get("p3")) === undefined, "p3 removido localmente");
  const filaP3 = await db.sync_queue
    .where("[entidade+entidade_id]")
    .equals(["pessoas", "p3"])
    .count();
  assert(filaP3 === 0, "p3 não ficou na fila (nada a enviar)");

  // -------------------------------------------------------------------------
  console.log("\n== E) delete de registro já sincronizado ==");
  await deleteLocal(db, "pessoas", "p2");
  assert((await db.pessoas.get("p2")) === undefined, "p2 removido localmente");
  await runSync(db, server);
  const aindaNoServidor = (await server.fetchSince("pessoas", null, 10)).some((x) => x.id === "p2");
  assert(!aindaNoServidor, "p2 removido do servidor");
  assert((await db.sync_queue.count()) === 0, "fila limpa no fim");

  await db.delete();
  console.log(`\nTODOS OS TESTES DE SYNC PASSARAM (${ts()})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
