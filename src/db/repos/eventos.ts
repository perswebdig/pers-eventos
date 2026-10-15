import { db } from "@/db/db";
import { deleteLocal, saveLocal } from "@/db/queue";
import type { EventoLocal, InscricaoLocal, PessoaLocal } from "@/db/types";
import type {
  EventoFormValues,
  InscricaoFormValues,
} from "@/features/eventos/evento-schema";

const nowIso = () => new Date().toISOString();

const nullify = (v: string) => {
  const t = v.trim();
  return t.length ? t : null;
};

const parseCapacidade = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const parseValor = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export async function listEventos(): Promise<EventoLocal[]> {
  const eventos = await db.eventos.toArray();
  return eventos.sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
}

export async function getEvento(id: string): Promise<EventoLocal | undefined> {
  return db.eventos.get(id);
}

export interface InscritoDetalhe {
  inscricao: InscricaoLocal;
  pessoa: PessoaLocal | null;
}

export interface EventoDetalhe {
  evento: EventoLocal;
  inscritos: InscritoDetalhe[];
  totalInscritos: number;
}

export async function getEventoDetalhe(id: string): Promise<EventoDetalhe | null> {
  const evento = await db.eventos.get(id);
  if (!evento) return null;

  const inscricoes = await db.inscricoes.where("evento_id").equals(id).toArray();
  const pessoas = await db.pessoas.bulkGet(inscricoes.map((i) => i.pessoa_id));
  const inscritos = inscricoes
    .map((inscricao, i) => ({ inscricao, pessoa: pessoas[i] ?? null }))
    .sort((a, b) =>
      (a.pessoa?.nome_completo ?? "").localeCompare(b.pessoa?.nome_completo ?? ""),
    );

  return { evento, inscritos, totalInscritos: inscricoes.length };
}

export async function countInscritos(eventoId: string): Promise<number> {
  return db.inscricoes.where("evento_id").equals(eventoId).count();
}

export async function saveEvento(
  values: EventoFormValues,
  id?: string,
): Promise<string> {
  const existente = id ? await db.eventos.get(id) : undefined;
  const eventoId = existente?.id ?? crypto.randomUUID();
  const now = nowIso();

  const evento: EventoLocal = {
    id: eventoId,
    nome: values.nome.trim(),
    descricao: nullify(values.descricao),
    data_inicio: values.data_inicio,
    data_fim: nullify(values.data_fim),
    local: nullify(values.local),
    capacidade: parseCapacidade(values.capacidade),
    status: values.status,
    created_at: existente?.created_at ?? now,
    updated_at: now,
    sync_status: "pending",
  };

  await saveLocal(db, "eventos", evento);
  return eventoId;
}

export async function deleteEvento(id: string): Promise<void> {
  // No servidor a exclusão em cascata remove inscrições e termos do evento.
  await db.transaction("rw", [db.inscricoes, db.termos], async () => {
    await db.inscricoes.where("evento_id").equals(id).delete();
    await db.termos.where("evento_id").equals(id).delete();
  });
  await deleteLocal(db, "eventos", id);
}

export interface InscricaoDetalhe {
  inscricao: InscricaoLocal;
  pessoa: PessoaLocal | null;
  evento: EventoLocal | null;
}

export async function getInscricaoDetalhe(
  id: string,
): Promise<InscricaoDetalhe | null> {
  const inscricao = await db.inscricoes.get(id);
  if (!inscricao) return null;
  const [pessoa, evento] = await Promise.all([
    db.pessoas.get(inscricao.pessoa_id),
    db.eventos.get(inscricao.evento_id),
  ]);
  return { inscricao, pessoa: pessoa ?? null, evento: evento ?? null };
}

// Registra a entrada. Idempotente enquanto já estiver em check-in; uma nova
// entrada (após checkout) gera um novo horário.
export async function fazerCheckin(id: string): Promise<InscricaoDetalhe | null> {
  const atual = await db.inscricoes.get(id);
  if (!atual) return null;
  const jaEmCheckin = atual.status === "checkin";
  await saveLocal(db, "inscricoes", {
    ...atual,
    status: "checkin",
    data_checkin: jaEmCheckin ? (atual.data_checkin ?? nowIso()) : nowIso(),
    data_checkout: null,
  } as InscricaoLocal);
  return getInscricaoDetalhe(id);
}

// Registra a saída (só faz sentido depois do check-in).
export async function fazerCheckout(id: string): Promise<InscricaoDetalhe | null> {
  const atual = await db.inscricoes.get(id);
  if (!atual) return null;
  await saveLocal(db, "inscricoes", {
    ...atual,
    status: "checkout",
    data_checkout: nowIso(),
  } as InscricaoLocal);
  return getInscricaoDetalhe(id);
}

// Busca inscrições por nome da pessoa (para o fallback manual da recepção).
export async function buscarInscricoes(
  termo: string,
  eventoId?: string | null,
): Promise<InscricaoDetalhe[]> {
  const t = termo.trim().toLowerCase();
  if (t.length < 2) return [];

  const inscricoes = eventoId
    ? await db.inscricoes.where("evento_id").equals(eventoId).toArray()
    : await db.inscricoes.toArray();
  const [pessoas, eventos] = await Promise.all([
    db.pessoas.bulkGet(inscricoes.map((i) => i.pessoa_id)),
    db.eventos.bulkGet(inscricoes.map((i) => i.evento_id)),
  ]);

  return inscricoes
    .map((inscricao, idx) => ({
      inscricao,
      pessoa: pessoas[idx] ?? null,
      evento: eventos[idx] ?? null,
    }))
    .filter(({ pessoa }) => pessoa?.nome_completo.toLowerCase().includes(t))
    .sort((a, b) =>
      (a.pessoa?.nome_completo ?? "").localeCompare(b.pessoa?.nome_completo ?? ""),
    )
    .slice(0, 20);
}

export async function getPessoaJaInscrita(
  eventoId: string,
  pessoaId: string,
): Promise<boolean> {
  const inscricoes = await db.inscricoes.where("evento_id").equals(eventoId).toArray();
  return inscricoes.some((i) => i.pessoa_id === pessoaId);
}

// Pessoas ainda não inscritas no evento (para o seletor de nova inscrição).
export async function listPessoasDisponiveis(eventoId: string): Promise<PessoaLocal[]> {
  const [pessoas, inscricoes] = await Promise.all([
    db.pessoas.orderBy("nome_completo").toArray(),
    db.inscricoes.where("evento_id").equals(eventoId).toArray(),
  ]);
  const inscritos = new Set(inscricoes.map((i) => i.pessoa_id));
  return pessoas.filter((p) => !inscritos.has(p.id));
}

export async function addInscricao(
  eventoId: string,
  values: InscricaoFormValues,
): Promise<string> {
  const jaInscrita = await getPessoaJaInscrita(eventoId, values.pessoa_id);
  if (jaInscrita) throw new Error("Esta pessoa já está inscrita neste evento.");

  const now = nowIso();
  const inscricao: InscricaoLocal = {
    id: crypto.randomUUID(),
    pessoa_id: values.pessoa_id,
    evento_id: eventoId,
    status: values.status,
    data_checkin: null,
    data_checkout: null,
    pagamento_status: values.pagamento_status,
    valor: parseValor(values.valor),
    forma_pagamento: nullify(values.forma_pagamento),
    termo_assinado: false,
    created_at: now,
    updated_at: now,
    sync_status: "pending",
  };

  await saveLocal(db, "inscricoes", inscricao);
  return inscricao.id;
}

export async function updateInscricao(
  id: string,
  patch: Partial<
    Pick<InscricaoLocal, "status" | "pagamento_status" | "valor" | "forma_pagamento">
  >,
): Promise<void> {
  const atual = await db.inscricoes.get(id);
  if (!atual) return;
  await saveLocal(db, "inscricoes", { ...atual, ...patch });
}

export async function removeInscricao(id: string): Promise<void> {
  await deleteLocal(db, "inscricoes", id);
}

export async function inscricoesPorEvento(): Promise<Map<string, number>> {
  const todas = await db.inscricoes.toArray();
  const mapa = new Map<string, number>();
  for (const i of todas) {
    mapa.set(i.evento_id, (mapa.get(i.evento_id) ?? 0) + 1);
  }
  return mapa;
}

// Busca local por nome, local ou status (IndexedDB, sem rede).
export function filtrarEventos(eventos: EventoLocal[], termo: string): EventoLocal[] {
  const t = termo.trim().toLowerCase();
  if (!t) return eventos;
  return eventos.filter(
    (e) =>
      e.nome.toLowerCase().includes(t) ||
      (e.local?.toLowerCase().includes(t) ?? false) ||
      e.status.toLowerCase().includes(t),
  );
}
