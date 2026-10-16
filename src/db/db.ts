import Dexie, { type Table } from "dexie";
import type {
  ArquivoLocal,
  CheckinQueueItem,
  DocumentoLocal,
  EventoLocal,
  InscricaoLocal,
  LogAcessoLocal,
  LoteLocal,
  MenorLocal,
  MetaLocal,
  OrderLocal,
  PessoaLocal,
  SyncCursor,
  SyncQueueItem,
  TermoLocal,
  TicketLocal,
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
  ticket_types!: Table<LoteLocal, string>;
  orders!: Table<OrderLocal, string>;
  tickets!: Table<TicketLocal, string>;
  checkin_queue!: Table<CheckinQueueItem, number>;
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
      documentos: "id, tenant_id, pessoa_id, tipo, uploaded_at, updated_at, sync_status",
      termos: "id, tenant_id, pessoa_id, evento_id, tipo, aceito_em, updated_at, sync_status",
      arquivos: "id, pessoa_id, uploaded, created_at",
      log_acesso_dados: "++id, tenant_id, user_id, pessoa_id, acao, criado_em",
      sync_queue: "++id, entidade, entidade_id, [entidade+entidade_id], operacao, created_at",
      sync_cursor: "tabela",
      meta: "key",
    });

    // v3 — Fase 2 (financeiro/ingressos): lotes, pedidos, ingressos e a fila
    // local de check-ins pendentes de envio ao servidor.
    this.version(3).stores({
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
      ticket_types:
        "id, tenant_id, event_id, is_active, updated_at, sync_status, [tenant_id+updated_at], [sync_status+updated_at]",
      orders:
        "id, tenant_id, event_id, customer_id, status, updated_at, sync_status, [tenant_id+updated_at], [sync_status+updated_at]",
      tickets:
        "id, tenant_id, order_id, ticket_type_id, customer_id, qr_code_hash, is_checked_in, updated_at, sync_status, [tenant_id+updated_at], [sync_status+updated_at]",
      checkin_queue: "++id, ticket_id, qr_code_hash, created_at",
      sync_queue: "++id, entidade, entidade_id, [entidade+entidade_id], operacao, created_at",
      sync_cursor: "tabela",
      meta: "key",
    });
  }
}

// Instância única do banco. Importe apenas em código client-side.
export const db = new PersEventosDB();
