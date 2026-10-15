import { db } from "@/db/db";
import { saveLocal, deleteLocal } from "@/db/queue";
import type { TermoLocal, LogAcessoLocal, ArquivoLocal } from "@/db/types";
import type { TermoAceiteValues } from "@/features/termos/termo-schema";

const nowIso = () => new Date().toISOString();

export async function listTermos(pessoaId?: string): Promise<TermoLocal[]> {
  let query = db.termos.orderBy("aceito_em").reverse();
  if (pessoaId) query = query.filter((t) => t.pessoa_id === pessoaId);
  return query.toArray();
}

export async function getTermo(id: string): Promise<TermoLocal | undefined> {
  return db.termos.get(id);
}

// Verifica se a pessoa já aceitou o termo (para o evento, se informado).
export async function jaAceitouTermo(
  pessoaId: string,
  tipo: "responsabilidade" | "imagem",
  eventoId?: string | null,
): Promise<boolean> {
  const termo = await db.termos
    .where("pessoa_id")
    .equals(pessoaId)
    .and((t) => t.tipo === tipo && (eventoId === undefined || t.evento_id === eventoId))
    .first();
  return !!termo;
}

// Registra o aceite + salva a assinatura como arquivo local (blob).
export async function registrarAceiteTermo(
  values: TermoAceiteValues,
  ip: string | null = null,
): Promise<string> {
  const termoId = crypto.randomUUID();
  const now = nowIso();

  // 1) Salva o arquivo da assinatura (blob) localmente.
  const base64 = values.assinatura_base64.replace(/^data:image\/\w+;base64,/, "");
  const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bin], { type: "image/png" });

  const arquivoId = crypto.randomUUID();
  const arquivo: ArquivoLocal = {
    id: arquivoId,
    pessoa_id: values.pessoa_id,
    tipo: "assinatura_termo",
    nome: `assinatura-${termoId}.png`,
    mime: "image/png",
    blob,
    uploaded: 0,
    created_at: now,
  };
  await db.arquivos.put(arquivo);

  // 2) Registra o termo referenciando o arquivo.
  const termo: TermoLocal = {
    id: termoId,
    pessoa_id: values.pessoa_id,
    evento_id: values.evento_id ?? null,
    tipo: values.tipo,
    aceito_em: now,
    ip,
    assinatura_url: arquivoId, // guarda o ID do arquivo local
    created_at: now,
    updated_at: now,
    sync_status: "pending",
  };

  await saveLocal(db, "termos", termo);
  return termoId;
}

export async function getAssinaturaBlob(termoId: string): Promise<Blob | null> {
  const termo = await db.termos.get(termoId);
  if (!termo?.assinatura_url) return null;
  const arquivo = await db.arquivos.get(termo.assinatura_url);
  return arquivo?.blob ?? null;
}

// Log de acesso a dados (LGPD).
export async function registrarLogAcesso(
  pessoaId: string | null,
  acao: string,
  userId: string | null = null,
): Promise<void> {
  const log: LogAcessoLocal = {
    id: 0, // auto
    user_id: userId,
    pessoa_id: pessoaId,
    acao,
    criado_em: nowIso(),
    sync_status: "pending",
  };
  await db.log_acesso_dados.add(log);
}

export async function listLogsAcesso(pessoaId?: string): Promise<LogAcessoLocal[]> {
  let query = db.log_acesso_dados.orderBy("criado_em").reverse();
  if (pessoaId) query = query.filter((l) => l.pessoa_id === pessoaId);
  return query.toArray();
}

// Limpeza de arquivos órfãos (assinaturas sem termo) — opcional.
export async function limparArquivosOrfaos(): Promise<number> {
  const todosTermos = await db.termos.toArray();
  const idsValidos = new Set(todosTermos.map((t) => t.assinatura_url).filter(Boolean));
  const todosArquivos = await db.arquivos.toArray();
  let removidos = 0;
  for (const a of todosArquivos) {
    if (!idsValidos.has(a.id)) {
      await db.arquivos.delete(a.id);
      removidos++;
    }
  }
  return removidos;
}