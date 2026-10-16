import type {
  Documento,
  Evento,
  Inscricao,
  LogAcessoDados,
  Menor,
  Order,
  Pessoa,
  SyncStatus,
  Termo,
  Ticket,
  TicketType,
} from "@/types/database";

// Campos que existem apenas no banco local (IndexedDB).
export interface LocalSyncFields {
  sync_status: SyncStatus;
  sync_error?: string;
}

export type PessoaLocal = Pessoa & LocalSyncFields;
export type MenorLocal = Menor & LocalSyncFields;
export type EventoLocal = Evento & LocalSyncFields;
export type InscricaoLocal = Inscricao & LocalSyncFields;
export type DocumentoLocal = Documento & LocalSyncFields;
export type TermoLocal = Termo & LocalSyncFields;
export type LogAcessoLocal = LogAcessoDados & LocalSyncFields;
export type LoteLocal = TicketType & LocalSyncFields;
export type OrderLocal = Order & LocalSyncFields;
export type TicketLocal = Ticket & LocalSyncFields;

// Fila local de check-ins de ingressos pendentes de envio
// (POST /api/tenant/check-in/sync). Separada do sync_queue porque ingressos
// são somente-leitura no pull; o check-in local é enviado por esta fila.
export interface CheckinQueueItem {
  id?: number;
  ticket_id: string;
  qr_code_hash: string;
  checked_in_at: string;
  created_at: string;
}

export type OperacaoSync = "insert" | "update" | "delete";

// Fila de operações pendentes de envio ao servidor.
export interface SyncQueueItem {
  id?: number;
  entidade: string; // nome da tabela (ex.: "pessoas")
  entidade_id: string;
  operacao: OperacaoSync;
  payload: Record<string, unknown> | null;
  tentativas: number;
  ultimo_erro?: string;
  created_at: string;
}

// Cursor de sincronização incremental por tabela (baseado em updated_at).
export interface SyncCursor {
  tabela: string;
  ultima_sincronizacao: string;
}

// Arquivos (foto/documento/assinatura) criados offline, enviados quando online.
export interface ArquivoLocal {
  id: string;
  pessoa_id: string | null;
  tipo: string;
  nome: string;
  mime: string;
  blob: Blob;
  uploaded: 0 | 1;
  created_at: string;
}

export interface MetaLocal {
  key: string;
  value: unknown;
}

export type EntidadeSync =
  | "pessoas"
  | "menores"
  | "eventos"
  | "ticket_types"
  | "orders"
  | "tickets"
  | "inscricoes"
  | "documentos"
  | "termos"
  | "log_acesso_dados";

// Ordem de sincronização respeitando dependências de FK:
// pessoas antes de menores/documentos/inscricoes; eventos antes de
// ticket_types; ticket_types antes de orders/tickets.
export const ENTIDADES: readonly EntidadeSync[] = [
  "pessoas",
  "eventos",
  "ticket_types",
  "menores",
  "documentos",
  "termos",
  "inscricoes",
  "log_acesso_dados",
] as const;

// Entidades baixadas do servidor no pull. `log_acesso_dados` é somente escrita
// (auditoria append-only) e não possui coluna `updated_at`, então fica fora.
// `orders` e `tickets` são criados no servidor (checkout/webhook) e apenas
// baixados para o dispositivo; o check-in local de ingressos usa a fila
// dedicada `checkin_queue` + rota /api/tenant/check-in/sync.
export const ENTIDADES_PULL: readonly EntidadeSync[] = [
  "pessoas",
  "eventos",
  "ticket_types",
  "orders",
  "tickets",
  "menores",
  "documentos",
  "termos",
  "inscricoes",
] as const;
