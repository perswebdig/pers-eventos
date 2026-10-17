import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// GET /api/tenant/espacos/:id/assentos — mapa de lugares do espaço (admin/recepção).
export async function GET(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  await supabase.rpc("liberar_reservas_expiradas");

  const { data: espaco, error } = await supabase
    .from("espacos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!espaco) return jsonError("Espaço não encontrado.", 404);

  const { data: assentos, error: assentosError } = await supabase
    .from("assentos")
    .select("id, fileira, numero, status")
    .eq("espaco_id", id)
    .order("fileira", { ascending: true })
    .order("numero", { ascending: true });

  if (assentosError) return jsonError(assentosError.message, 500);

  return NextResponse.json({ data: { espaco, assentos: assentos ?? [] } });
}
