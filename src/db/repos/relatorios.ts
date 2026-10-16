import { db } from "@/db/db";
import type { PessoaLocal, EventoLocal, InscricaoLocal, TermoLocal } from "@/db/types";

export interface PessoaResumo {
  total: number;
  comCpf: number;
  menores: number;
  adultos: number;
  consentimentoLgpd: number;
  porStatusSync: Record<string, number>;
}

export async function getPessoasResumo(): Promise<PessoaResumo> {
  const pessoas = await db.pessoas.toArray();
  const menores = await db.menores.toArray();
  const menoresIds = new Set(menores.map((m) => m.pessoa_id));

  const porStatusSync: Record<string, number> = {};
  for (const p of pessoas) {
    porStatusSync[p.sync_status] = (porStatusSync[p.sync_status] ?? 0) + 1;
  }

  return {
    total: pessoas.length,
    comCpf: pessoas.filter((p) => p.cpf).length,
    menores: menoresIds.size,
    adultos: pessoas.length - menoresIds.size,
    consentimentoLgpd: pessoas.filter((p) => p.consentimento_lgpd).length,
    porStatusSync,
  };
}

export interface EventoResumo {
  total: number;
  porStatus: Record<string, number>;
  capacidadeTotal: number;
  vagasPreenchidas: number;
  porStatusSync: Record<string, number>;
}

export async function getEventosResumo(): Promise<EventoResumo> {
  const [eventos, inscricoes] = await Promise.all([db.eventos.toArray(), db.inscricoes.toArray()]);

  const porStatus: Record<string, number> = {};
  let capacidadeTotal = 0;
  let vagasPreenchidas = 0;
  const porStatusSync: Record<string, number> = {};

  for (const e of eventos) {
    porStatus[e.status] = (porStatus[e.status] ?? 0) + 1;
    if (e.capacidade !== null && e.capacidade > 0) {
      capacidadeTotal += e.capacidade;
    }
    porStatusSync[e.sync_status] = (porStatusSync[e.sync_status] ?? 0) + 1;
  }

  vagasPreenchidas = inscricoes.length;

  return { total: eventos.length, porStatus, capacidadeTotal, vagasPreenchidas, porStatusSync };
}

export interface InscricaoResumo {
  total: number;
  porStatus: Record<string, number>;
  porPagamento: Record<string, number>;
  checkinsRealizados: number;
  checkoutsRealizados: number;
  porStatusSync: Record<string, number>;
}

export async function getInscricoesResumo(): Promise<InscricaoResumo> {
  const inscricoes = await db.inscricoes.toArray();

  const porStatus: Record<string, number> = {};
  const porPagamento: Record<string, number> = {};
  const porStatusSync: Record<string, number> = {};
  let checkinsRealizados = 0;
  let checkoutsRealizados = 0;

  for (const i of inscricoes) {
    porStatus[i.status] = (porStatus[i.status] ?? 0) + 1;
    porPagamento[i.pagamento_status] = (porPagamento[i.pagamento_status] ?? 0) + 1;
    porStatusSync[i.sync_status] = (porStatusSync[i.sync_status] ?? 0) + 1;
    if (i.data_checkin) checkinsRealizados++;
    if (i.data_checkout) checkoutsRealizados++;
  }

  return {
    total: inscricoes.length,
    porStatus,
    porPagamento,
    checkinsRealizados,
    checkoutsRealizados,
    porStatusSync,
  };
}

export interface TermoResumo {
  total: number;
  porTipo: Record<string, number>;
  porStatusSync: Record<string, number>;
}

export async function getTermosResumo(): Promise<TermoResumo> {
  const termos = await db.termos.toArray();
  const porTipo: Record<string, number> = {};
  const porStatusSync: Record<string, number> = {};

  for (const t of termos) {
    porTipo[t.tipo] = (porTipo[t.tipo] ?? 0) + 1;
    porStatusSync[t.sync_status] = (porStatusSync[t.sync_status] ?? 0) + 1;
  }

  return { total: termos.length, porTipo, porStatusSync };
}

export interface LogAcessoResumo {
  total: number;
  porAcao: Record<string, number>;
  ultimosDias: Array<{ data: string; count: number }>;
}

export async function getLogsAcessoResumo(): Promise<LogAcessoResumo> {
  const logs = await db.log_acesso_dados.toArray();
  const porAcao: Record<string, number> = {};
  const porDia: Record<string, number> = {};

  for (const l of logs) {
    porAcao[l.acao] = (porAcao[l.acao] ?? 0) + 1;
    const dia = l.criado_em.slice(0, 10);
    porDia[dia] = (porDia[dia] ?? 0) + 1;
  }

  const ultimosDias = Object.entries(porDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([data, count]) => ({ data, count }));

  return { total: logs.length, porAcao, ultimosDias };
}

// Exportação de dados para CSV
export function toCSV<T extends Record<string, unknown>>(rows: T[], headers?: string[]): string {
  if (rows.length === 0) return "";
  const cols = headers ?? Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export async function exportarPessoasCSV(): Promise<string> {
  const pessoas = await db.pessoas.toArray();
  return toCSV(
    pessoas.map((p) => ({
      id: p.id,
      nome: p.nome_completo,
      cpf: p.cpf ?? "",
      rg: p.rg ?? "",
      nascimento: p.data_nascimento ?? "",
      telefone: p.telefone ?? "",
      email: p.email ?? "",
      endereco: p.endereco ?? "",
      contato_emergencia_nome: p.contato_emergencia_nome ?? "",
      contato_emergencia_telefone: p.contato_emergencia_telefone ?? "",
      restricoes: p.restricoes_alimentares ?? "",
      saude: p.condicoes_saude ?? "",
      medicacoes: p.medicacoes ?? "",
      observacoes: p.observacoes ?? "",
      lgpd: p.consentimento_lgpd ? "sim" : "nao",
      menor:
        p.data_nascimento &&
        new Date(p.data_nascimento) > new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000)
          ? "sim"
          : "nao",
      created_at: p.created_at,
      updated_at: p.updated_at,
      sync_status: p.sync_status,
    })),
  );
}

export async function exportarEventosCSV(): Promise<string> {
  const eventos = await db.eventos.toArray();
  return toCSV(
    eventos.map((e) => ({
      id: e.id,
      nome: e.nome,
      descricao: e.descricao ?? "",
      inicio: e.data_inicio,
      fim: e.data_fim ?? "",
      local: e.local ?? "",
      capacidade: e.capacidade ?? "",
      status: e.status,
      created_at: e.created_at,
      updated_at: e.updated_at,
      sync_status: e.sync_status,
    })),
  );
}

export async function exportarInscricoesCSV(): Promise<string> {
  const [inscricoes, pessoas, eventos] = await Promise.all([
    db.inscricoes.toArray(),
    db.pessoas.toArray(),
    db.eventos.toArray(),
  ]);
  const pMap = new Map(pessoas.map((p) => [p.id, p]));
  const eMap = new Map(eventos.map((e) => [e.id, e]));

  return toCSV(
    inscricoes.map((i) => ({
      id: i.id,
      pessoa_id: i.pessoa_id,
      pessoa_nome: pMap.get(i.pessoa_id)?.nome_completo ?? "",
      evento_id: i.evento_id,
      evento_nome: eMap.get(i.evento_id)?.nome ?? "",
      status: i.status,
      checkin: i.data_checkin ?? "",
      checkout: i.data_checkout ?? "",
      pagamento_status: i.pagamento_status,
      valor: i.valor ?? "",
      forma_pagamento: i.forma_pagamento ?? "",
      termo_assinado: i.termo_assinado ? "sim" : "nao",
      created_at: i.created_at,
      updated_at: i.updated_at,
      sync_status: i.sync_status,
    })),
  );
}

export async function exportarTermosCSV(): Promise<string> {
  const [termos, pessoas] = await Promise.all([db.termos.toArray(), db.pessoas.toArray()]);
  const pMap = new Map(pessoas.map((p) => [p.id, p]));

  return toCSV(
    termos.map((t) => ({
      id: t.id,
      pessoa_id: t.pessoa_id,
      pessoa_nome: pMap.get(t.pessoa_id)?.nome_completo ?? "",
      evento_id: t.evento_id ?? "",
      tipo: t.tipo,
      aceito_em: t.aceito_em,
      ip: t.ip ?? "",
      created_at: t.created_at,
      updated_at: t.updated_at,
      sync_status: t.sync_status,
    })),
  );
}

export async function exportarLogsAcessoCSV(): Promise<string> {
  const logs = await db.log_acesso_dados.toArray();
  return toCSV(
    logs.map((l) => ({
      id: l.id,
      user_id: l.user_id ?? "",
      pessoa_id: l.pessoa_id ?? "",
      acao: l.acao,
      criado_em: l.criado_em,
    })),
  );
}

// Dados para gráfico de check-ins por dia (últimos 30 dias)
export async function getCheckinsPorDia(
  dias = 30,
): Promise<Array<{ data: string; checkins: number; checkouts: number }>> {
  const inscricoes = await db.inscricoes.toArray();
  const porDia: Record<string, { checkins: number; checkouts: number }> = {};

  const inicio = new Date();
  inicio.setDate(inicio.getDate() - dias);
  const inicioISO = inicio.toISOString();

  for (const i of inscricoes) {
    if (i.data_checkin && i.data_checkin >= inicioISO) {
      const dia = i.data_checkin.slice(0, 10);
      if (!porDia[dia]) porDia[dia] = { checkins: 0, checkouts: 0 };
      porDia[dia].checkins++;
    }
    if (i.data_checkout && i.data_checkout >= inicioISO) {
      const dia = i.data_checkout.slice(0, 10);
      if (!porDia[dia]) porDia[dia] = { checkins: 0, checkouts: 0 };
      porDia[dia].checkouts++;
    }
  }

  return Object.entries(porDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, v]) => ({ data, checkins: v.checkins, checkouts: v.checkouts }));
}
