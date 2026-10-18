import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

// GET /api/portal/eventos — feed público: eventos abertos/planejados de todos
// os estabelecimentos ativos. O RLS libera o catálogo; a API ordena por data e
// traz o estabelecimento e as faixas de preço (lotes e ambientes).
export async function GET() {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;

  // Mostra eventos de hoje em diante (tolerância de 12h para o fuso local).
  const desde = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .select(
      "*, estabelecimento:estabelecimentos(nome, cidade, estado), " +
        "ticket_types(price, is_active), espacos(price, is_active)",
    )
    .in("status", ["aberto", "planejado"])
    .gte("data_inicio", desde)
    .order("data_inicio", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
}
