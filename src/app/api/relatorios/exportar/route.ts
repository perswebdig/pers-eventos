import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { toCSV } from "@/lib/csv";
import { ehMenor } from "@/lib/format";

const TIPOS = ["pessoas", "eventos", "inscricoes", "termos", "logs"] as const;
type Tipo = (typeof TIPOS)[number];

// GET /api/relatorios/exportar?tipo=pessoas|eventos|inscricoes|termos|logs
export async function GET(request: Request) {
  const guard = await apiSession(["tenant_admin", "super_admin"]);
  if (guard.response) return guard.response;

  const tipo = (new URL(request.url).searchParams.get("tipo") ?? "") as Tipo;
  if (!TIPOS.includes(tipo)) return jsonError("Tipo de exportação inválido.", 400);

  const supabase = await createClient();
  let csv = "";

  if (tipo === "pessoas") {
    const { data, error } = await supabase.from("pessoas").select("*");
    if (error) return jsonError(error.message, 500);
    csv = toCSV(
      (data ?? []).map((p) => ({
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
        menor: ehMenor(p.data_nascimento) ? "sim" : "nao",
        created_at: p.created_at,
        updated_at: p.updated_at,
      })),
    );
  } else if (tipo === "eventos") {
    const { data, error } = await supabase.from("eventos").select("*");
    if (error) return jsonError(error.message, 500);
    csv = toCSV(
      (data ?? []).map((e) => ({
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
      })),
    );
  } else if (tipo === "inscricoes") {
    const { data, error } = await supabase
      .from("inscricoes")
      .select("*, pessoa:pessoas(nome_completo), evento:eventos(nome)");
    if (error) return jsonError(error.message, 500);
    csv = toCSV(
      (data ?? []).map((i) => ({
        id: i.id,
        pessoa_id: i.pessoa_id,
        pessoa_nome: i.pessoa?.nome_completo ?? "",
        evento_id: i.evento_id,
        evento_nome: i.evento?.nome ?? "",
        status: i.status,
        checkin: i.data_checkin ?? "",
        checkout: i.data_checkout ?? "",
        pagamento_status: i.pagamento_status,
        valor: i.valor ?? "",
        forma_pagamento: i.forma_pagamento ?? "",
        termo_assinado: i.termo_assinado ? "sim" : "nao",
        created_at: i.created_at,
        updated_at: i.updated_at,
      })),
    );
  } else if (tipo === "termos") {
    const { data, error } = await supabase
      .from("termos")
      .select("*, pessoa:pessoas(nome_completo)")
      .order("aceito_em", { ascending: false });
    if (error) return jsonError(error.message, 500);
    csv = toCSV(
      (data ?? []).map((t) => ({
        id: t.id,
        pessoa_id: t.pessoa_id,
        pessoa_nome: t.pessoa?.nome_completo ?? "",
        evento_id: t.evento_id ?? "",
        tipo: t.tipo,
        aceito_em: t.aceito_em,
        ip: t.ip ?? "",
        assinatura: t.assinatura_url ?? "",
        created_at: t.created_at,
      })),
    );
  } else {
    const { data, error } = await supabase
      .from("log_acesso_dados")
      .select("*")
      .order("criado_em", { ascending: false });
    if (error) return jsonError(error.message, 500);
    csv = toCSV(
      (data ?? []).map((l) => ({
        id: l.id,
        user_id: l.user_id ?? "",
        pessoa_id: l.pessoa_id ?? "",
        acao: l.acao,
        criado_em: l.criado_em,
      })),
    );
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tipo}.csv"`,
    },
  });
}
