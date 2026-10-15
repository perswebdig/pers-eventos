import "fake-indexeddb/auto";
import { PersEventosDB } from "../src/db/db";
import type { PessoaLocal, SyncQueueItem } from "../src/db/types";

// Smoke test das migrations do Dexie fora do browser (Node + fake-indexeddb).
// Rode com: npm run db:verify
const TABELAS_ESPERADAS = [
  "pessoas",
  "menores",
  "eventos",
  "inscricoes",
  "documentos",
  "termos",
  "arquivos",
  "sync_queue",
  "sync_cursor",
  "meta",
];

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FALHOU: ${msg}`);
}

async function main() {
  const db = new PersEventosDB("pers-eventos-verify");
  await db.delete(); // garante estado limpo
  await db.open();

  for (const t of TABELAS_ESPERADAS) {
    assert(db.tables.some((x) => x.name === t), `tabela "${t}" existe`);
  }
  console.log(`OK  ${TABELAS_ESPERADAS.length} tabelas criadas`);

  const ts = new Date().toISOString();
  const pessoa: PessoaLocal = {
    id: crypto.randomUUID(),
    nome_completo: "Teste Offline",
    cpf: "00000000000",
    rg: null,
    data_nascimento: null,
    telefone: "(11) 90000-0000",
    email: "teste@exemplo.com",
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
    sync_status: "pending",
  };
  await db.pessoas.put(pessoa);

  const lida = await db.pessoas.get(pessoa.id);
  assert(lida?.nome_completo === "Teste Offline", "insere e lê pessoas");

  // Busca indexada por nome e por telefone.
  const porNome = await db.pessoas.where("nome_completo").equals("Teste Offline").count();
  const porTel = await db.pessoas.where("telefone").equals("(11) 90000-0000").count();
  assert(porNome === 1 && porTel === 1, "índices de nome/telefone");
  console.log("OK  insere, lê e busca por índices");

  const item: SyncQueueItem = {
    entidade: "pessoas",
    entidade_id: pessoa.id,
    operacao: "insert",
    payload: { nome_completo: pessoa.nome_completo },
    tentativas: 0,
    created_at: ts,
  };
  const qid = await db.sync_queue.add(item);
  const pendentes = await db.sync_queue
    .where("[entidade+entidade_id]")
    .equals(["pessoas", pessoa.id])
    .count();
  assert(pendentes === 1, "índice composto da fila");
  await db.sync_queue.delete(qid);
  console.log("OK  fila de sync (índice composto)");

  await db.sync_cursor.put({ tabela: "pessoas", ultima_sincronizacao: ts });
  const cursor = await db.sync_cursor.get("pessoas");
  assert(cursor?.tabela === "pessoas", "cursor de sincronização");
  console.log("OK  cursor de sincronização");

  await db.delete();
  console.log("\nTODOS OS TESTES DE DEXIE PASSARAM");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
