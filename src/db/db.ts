import Dexie, { type Table } from "dexie";
import type {
  ArquivoLocal,
  DocumentoLocal,
  EventoLocal,
  InscricaoLocal,
  LogAcessoLocal,
  MenorLocal,
  MetaLocal,
  PessoaLocal,
  SyncCursor,
  SyncQueueItem,
  TermoLocal,
} from "./types";

// Nome do banco local. Um banco por navegador/dispositivo.
export const DB_NAME = "pers-eventos";

export class PersEventosDB extends Dexie {
  pessoas!: Table<PessoaLocal, string>;
  menores!: Table<MenorLocal, string>;
  eventos!: Table<EventoLocal, string>;
  inscricoes!: Table<InscricaoLocal, string>;
  documentos!: Table<DocumentoLocal, string>;
  termos!: Table<TermoLocal, string>;
  arquivos!: Table<ArquivoLocal, string>;
  log_acesso_dados!: Table<LogAcessoLocal, number>;
  sync_queue!: Table<SyncQueueItem, number>;
  sync_cursor!: Table<SyncCursor, string>;
  meta!: Table<MetaLocal, string>;

  constructor(name = DB_NAME) {
    super(name);

    // v1 — estrutura inicial. Ao evoluir o schema, adicione version(2) etc.
    // Índices: `[sync_status+updated_at]` acelera o envio de pendentes;
    // `updated_at` acelera o pull incremental.
    this.version(1).stores({
      pessoas:
        "id, cpf, nome_completo, telefone, email, updated_at, sync_status, [sync_status+updated_at]",
      menores: "id, pessoa_id, updated_at, sync_status, [sync_status+updated_at]",
      eventos: "id, status, data_inicio, updated_at, sync_status, [sync_status+updated_at]",
      inscricoes:
        "id, pessoa_id, evento_id, status, updated_at, sync_status, [evento_id+status], [sync_status+updated_at]",
      documentos: "id, pessoa_id, tipo, uploaded_at, updated_at, sync_status",
      termos: "id, pessoa_id, evento_id, tipo, aceito_em, updated_at, sync_status",
      arquivos: "id, pessoa_id, uploaded, created_at",
      log_acesso_dados: "++id, user_id, pessoa_id, acao, criado_em",
      sync_queue: "++id, entidade, entidade_id, [entidade+entidade_id], operacao, created_at",
      sync_cursor: "tabela",
      meta: "key",
    });

    // v2 — Multitenant: índice `tenant_id` nas tabelas de domínio para permitir
    // escopo local por estabelecimento (isolamento no dispositivo).
    this.version(2).stores({
      pessoas:
        "id, tenant_id, cpf, nome_completo, telefone, email, updated_at, sync_status, [tenant_id+updated_at], [sync_status+updated_at]",
      menores:
        "id, tenant_id, pessoa_id, updated_at, sync_status, [tenant_id+updated_at], [sync_status+updated_at]",
      eventos:
        "id, tenant_id, status, data_inicio, updated_at, sync_status, [tenant_id+updated_at], [sync_status+updated_at]",
      inscricoes:
        "id, tenant_id, pessoa_id, evento_id, status, updated_at, sync_status, [evento_id+status], [tenant_id+updated_at], [sync_status+updated_at]",
      documentos:
        "id, tenant_id, pessoa_id, tipo, uploaded_at, updated_at, sync_status",
      termos:
        "id, tenant_id, pessoa_id, evento_id, tipo, aceito_em, updated_at, sync_status",
      arquivos: "id, pessoa_id, uploaded, created_at",
      log_acesso_dados: "++id, tenant_id, user_id, pessoa_id, acao, criado_em",
      sync_queue: "++id, entidade, entidade_id, [entidade+entidade_id], operacao, created_at",
      sync_cursor: "tabela",
      meta: "key",
    });
  }
}

// Instância única do banco. Importe apenas em código client-side.
export const db = new PersEventosDB();
