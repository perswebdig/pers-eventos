import type {
  Documento,
  Evento,
  Inscricao,
  LogAcessoDados,
  Menor,
  Pessoa,
  SyncStatus,
  Termo,
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
  "pessoas" | "menores" | "eventos" | "inscricoes" | "documentos" | "termos" | "log_acesso_dados";

// Ordem de sincronização respeitando dependências de FK:
// pessoas antes de menores/documentos/inscricoes; eventos antes de inscricoes.
export const ENTIDADES: readonly EntidadeSync[] = [
  "pessoas",
  "eventos",
  "menores",
  "documentos",
  "termos",
  "inscricoes",
  "log_acesso_dados",
] as const;

// Entidades baixadas do servidor no pull. `log_acesso_dados` é somente escrita
// (auditoria append-only) e não possui coluna `updated_at`, então fica fora.
export const ENTIDADES_PULL: readonly EntidadeSync[] = [
  "pessoas",
  "eventos",
  "menores",
  "documentos",
  "termos",
  "inscricoes",
] as const;
