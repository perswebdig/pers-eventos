import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

// GET /api/portal/eventos — eventos abertos no estabelecimento do cliente.
export async function GET() {
  const guard = await apiSession(["cliente"]);
  if (guard.response) return guard.response;

  const supabase = await createClient();
  // Limita a eventos "abertos" (quando houver). RLS já restringe pelo tenant.
  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .in("status", ["aberto", "planejado"])
    .order("data_inicio", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
}
