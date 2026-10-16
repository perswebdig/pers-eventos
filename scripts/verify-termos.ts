import "fake-indexeddb/auto";
import Dexie from "dexie";
import {
  registrarAceiteTermo,
  listTermos,
  getAssinaturaBlob,
  jaAceitouTermo,
  registrarLogAcesso,
  listLogsAcesso,
} from "../src/db/repos/termos";
import { termoTipoLabel } from "../src/features/termos/termo-schema";
import type { SyncStatus } from "../src/types/database";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FALHOU: ${msg}`);
  console.log(`OK  ${msg}`);
}

function pessoa(nome: string) {
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
    sync_status: "synced" as SyncStatus,
  };
}

// Banco mínimo só com as tabelas necessárias para o teste de termos
class TestDB extends Dexie {
  pessoas!: Dexie.Table<any, string>;
  menores!: Dexie.Table<any, string>;
  termos!: Dexie.Table<any, string>;
  arquivos!: Dexie.Table<any, string>;
  log_acesso_dados!: Dexie.Table<any, number>;

  constructor(name: string) {
    super(name);
    // Versão alta para evitar colisão de schema cacheado no fake-indexeddb
    const version = 50 + Math.floor(Math.random() * 1000);
    this.version(version).stores({
      pessoas: "id, cpf, nome_completo, telefone, email, updated_at, sync_status",
      menores: "id, pessoa_id, updated_at, sync_status",
      termos: "id, pessoa_id, evento_id, tipo, aceito_em, updated_at, sync_status",
      arquivos: "id, pessoa_id, uploaded, created_at",
      log_acesso_dados: "++id, user_id, pessoa_id, acao, criado_em",
      _termos_test_schema_marker_uniq: "++id", // tabela única para diferenciar schema
      _u: "++id", // tabela com UUID no nome para forçar schema único
    });
  }
}

async function main() {
  const dbName = `pers-eventos-termos-verify-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testDb = new TestDB(dbName);
  await testDb.delete();
  await testDb.open();

  console.log("== Termo schema labels ==");
  assert(
    termoTipoLabel("responsabilidade") === "Termo de Responsabilidade",
    "label responsabilidade",
  );
  assert(termoTipoLabel("imagem") === "Termo de Uso de Imagem", "label imagem");
  assert(termoTipoLabel("outro") === "outro", "label desconhecido");

  console.log("\n== Repositório termos + LGPD ==");

  const p1 = pessoa("Ana Teste");
  await testDb.pessoas.put(p1);

  // A) registrar aceite de termo de responsabilidade
  const termoId = await registrarAceiteTermo({
    pessoa_id: p1.id,
    tipo: "responsabilidade",
    assinatura_base64:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  });
  const termos = await listTermos(p1.id);
  assert(termos.length === 1, "termo criado");
  assert(termos[0].tipo === "responsabilidade", "tipo correto");
  assert(termos[0].sync_status === "pending", "marcado pending");

  // B) verificar jaAceitouTermo
  assert((await jaAceitouTermo(p1.id, "responsabilidade")) === true, "já aceitou responsabilidade");
  assert((await jaAceitouTermo(p1.id, "imagem")) === false, "não aceitou imagem");

  // C) assinatura blob
  const blob = await getAssinaturaBlob(termoId);
  assert(blob instanceof Blob && blob.size > 0, "blob da assinatura existe");

  // D) segundo aceite (imagem) para mesma pessoa
  await registrarAceiteTermo({
    pessoa_id: p1.id,
    tipo: "imagem",
    assinatura_base64:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  });
  const todos = await listTermos(p1.id);
  assert(todos.length === 2, "dois termos aceitos");

  // E) log de acesso
  await registrarLogAcesso(p1.id, "visualizou_assinatura", "user-123");
  await registrarLogAcesso(null, "sistema_limpeza", null);
  const logs = await listLogsAcesso(p1.id);
  assert(logs.length >= 1, "log registrado");
  assert(logs[0].acao === "visualizou_assinatura", "ação correta");
  assert(logs[0].pessoa_id === p1.id, "pessoa_id no log");
  assert(logs[0].sync_status === "pending", "log pending");

  await testDb.delete();
  console.log("\nTODOS OS TESTES DE TERMOS PASSARAM");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
