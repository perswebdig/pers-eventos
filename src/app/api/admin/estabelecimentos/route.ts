import { NextResponse } from "next/server";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  estabelecimentoSchema,
  toEstabelecimentoRow,
} from "@/features/admin/estabelecimento-schema";

// GET /api/admin/estabelecimentos — lista todos os tenants com métricas (Super Admin).
export async function GET() {
  const guard = await apiSession(["super_admin"]);
  if (guard.response) return guard.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estabelecimentos")
    .select("*")
    .order("nome", { ascending: true });

  if (error) return jsonError(error.message, 500);

  const admin = createAdminClient();
  const comMetricas = await Promise.all(
    (data ?? []).map(async (e) => {
      const [pessoas, eventos, pedidos] = await Promise.all([
        admin
          .from("pessoa_estabelecimentos")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", e.id),
        admin.from("eventos").select("id", { count: "exact", head: true }).eq("tenant_id", e.id),
        admin.from("orders").select("id", { count: "exact", head: true }).eq("tenant_id", e.id),
      ]);
      return {
        ...e,
        metricas: {
          pessoas: pessoas.count ?? 0,
          eventos: eventos.count ?? 0,
          pedidos: pedidos.count ?? 0,
        },
      };
    }),
  );

  return NextResponse.json({ data: comMetricas });
}

// POST /api/admin/estabelecimentos — cria um tenant (Super Admin).
export async function POST(request: Request) {
  const guard = await apiSession(["super_admin"]);
  if (guard.response) return guard.response;

  const { data, response } = await parseBody(request, estabelecimentoSchema);
  if (response) return response;

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("estabelecimentos")
    .insert(toEstabelecimentoRow(data!))
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonError("Já existe um estabelecimento com este slug ou CNPJ.", 409);
    }
    return jsonError(error.message, 400);
  }
  return NextResponse.json({ data: created }, { status: 201 });
}
