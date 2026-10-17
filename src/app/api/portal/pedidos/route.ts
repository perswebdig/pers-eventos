import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

// GET /api/portal/pedidos — pedidos do cliente logado com ingressos e evento.
export async function GET() {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  if (!ctx.pessoaId) return NextResponse.json({ data: [] });

  const supabase = await createClient();
  const comEspaco = await supabase
    .from("orders")
    .select("*, evento:eventos(*), ticket_type:ticket_types(*), espaco:espacos(*), tickets(*)")
    .eq("customer_id", ctx.pessoaId)
    .order("created_at", { ascending: false });

  // Estrutura de espaços ainda indisponível (migração não aplicada): a
  // carteira de ingressos continua funcionando sem o embed do setor.
  const resultado = comEspaco.error
    ? await supabase
        .from("orders")
        .select("*, evento:eventos(*), ticket_type:ticket_types(*), tickets(*)")
        .eq("customer_id", ctx.pessoaId)
        .order("created_at", { ascending: false })
    : comEspaco;

  if (resultado.error) return jsonError(resultado.error.message, 500);
  return NextResponse.json({ data: resultado.data ?? [] });
}
