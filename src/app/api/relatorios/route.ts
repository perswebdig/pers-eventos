import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

function contar<T extends string>(valores: T[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  for (const v of valores) {
    const chave = v ?? "—";
    mapa[chave] = (mapa[chave] ?? 0) + 1;
  }
  return mapa;
}

// GET /api/relatorios — resumos do estabelecimento (Admin do Estabelecimento).
export async function GET() {
  const guard = await apiSession(["tenant_admin", "super_admin"]);
  if (guard.response) return guard.response;

  const supabase = await createClient();

  const [pessoasRes, menoresRes, eventosRes, inscricoesRes, termosRes, logsRes] = await Promise.all(
    [
      supabase.from("pessoas").select("id, cpf, consentimento_lgpd, data_nascimento"),
      supabase.from("menores").select("pessoa_id"),
      supabase.from("eventos").select("id, status, capacidade, created_at"),
      supabase
        .from("inscricoes")
        .select("id, status, pagamento_status, data_checkin, data_checkout"),
      supabase.from("termos").select("id, tipo, aceito_em"),
      supabase.from("log_acesso_dados").select("id, acao, criado_em"),
    ],
  );

  const erro =
    pessoasRes.error ??
    menoresRes.error ??
    eventosRes.error ??
    inscricoesRes.error ??
    termosRes.error ??
    logsRes.error;
  if (erro) return jsonError(erro.message, 500);

  const pessoas = pessoasRes.data ?? [];
  const menores = menoresRes.data ?? [];
  const eventos = eventosRes.data ?? [];
  const inscricoes = inscricoesRes.data ?? [];
  const termos = termosRes.data ?? [];
  const logs = logsRes.data ?? [];

  const menoresIds = new Set(menores.map((m) => m.pessoa_id));

  const pessoasResumo = {
    total: pessoas.length,
    comCpf: pessoas.filter((p) => p.cpf).length,
    menores: menoresIds.size,
    adultos: pessoas.length - menoresIds.size,
    consentimentoLgpd: pessoas.filter((p) => p.consentimento_lgpd).length,
  };

  const capacidadeTotal = eventos.reduce(
    (acc, e) => acc + (e.capacidade && e.capacidade > 0 ? e.capacidade : 0),
    0,
  );
  const eventosResumo = {
    total: eventos.length,
    porStatus: contar(eventos.map((e) => e.status)),
    capacidadeTotal,
    vagasPreenchidas: inscricoes.length,
  };

  const inscricoesResumo = {
    total: inscricoes.length,
    porStatus: contar(inscricoes.map((i) => i.status)),
    porPagamento: contar(inscricoes.map((i) => i.pagamento_status)),
    checkinsRealizados: inscricoes.filter((i) => i.data_checkin).length,
    checkoutsRealizados: inscricoes.filter((i) => i.data_checkout).length,
  };

  const termosResumo = {
    total: termos.length,
    porTipo: contar(termos.map((t) => t.tipo)),
  };

  const porAcao = contar(logs.map((l) => l.acao));
  const porDia: Record<string, number> = {};
  for (const l of logs) {
    const dia = l.criado_em.slice(0, 10);
    porDia[dia] = (porDia[dia] ?? 0) + 1;
  }
  const logsResumo = {
    total: logs.length,
    porAcao,
    ultimosDias: Object.entries(porDia)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([data, count]) => ({ data, count })),
  };

  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 30);
  const inicioISO = inicio.toISOString();
  const movPorDia: Record<string, { checkins: number; checkouts: number }> = {};
  for (const i of inscricoes) {
    if (i.data_checkin && i.data_checkin >= inicioISO) {
      const dia = i.data_checkin.slice(0, 10);
      movPorDia[dia] ??= { checkins: 0, checkouts: 0 };
      movPorDia[dia].checkins++;
    }
    if (i.data_checkout && i.data_checkout >= inicioISO) {
      const dia = i.data_checkout.slice(0, 10);
      movPorDia[dia] ??= { checkins: 0, checkouts: 0 };
      movPorDia[dia].checkouts++;
    }
  }
  const checkinsPorDia = Object.entries(movPorDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, v]) => ({ data, checkins: v.checkins, checkouts: v.checkouts }));

  return NextResponse.json({
    data: {
      pessoas: pessoasResumo,
      eventos: eventosResumo,
      inscricoes: inscricoesResumo,
      termos: termosResumo,
      logs: logsResumo,
      checkinsPorDia,
    },
  });
}
