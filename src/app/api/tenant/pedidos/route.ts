import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

// GET /api/tenant/pedidos — pedidos do estabelecimento (equipe).
export async function GET() {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, quantity, total_amount, payment_method, created_at, espaco_id, " +
        "pessoa:pessoas!orders_customer_id_fkey(nome_completo), " +
        "evento:eventos(nome, data_inicio), " +
        "ticket_type:ticket_types(name), " +
        "espaco:espacos(nome)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
}
