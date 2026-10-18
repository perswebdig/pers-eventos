import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

// GET /api/inscricoes?busca=<nome>&evento=<id> — busca manual da recepção.
export async function GET(request: Request) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;

  const params = new URL(request.url).searchParams;
  const termo = (params.get("busca") ?? "").trim().toLowerCase();
  const eventoId = params.get("evento")?.trim() || null;

  if (termo.length < 2) {
    return NextResponse.json({ data: [] });
  }

  const supabase = await createClient();
  let query = supabase
    .from("inscricoes")
    .select("*, pessoa:pessoas(*), evento:eventos(id, nome, data_inicio)")
    .order("created_at", { ascending: false });

  if (eventoId) query = query.eq("evento_id", eventoId);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  const resultados = (data ?? [])
    .filter((i) => (i.pessoa?.nome_completo ?? "").toLowerCase().includes(termo))
    .sort((a, b) => (a.pessoa?.nome_completo ?? "").localeCompare(b.pessoa?.nome_completo ?? ""))
    .slice(0, 20);

  return NextResponse.json({ data: resultados });
}
