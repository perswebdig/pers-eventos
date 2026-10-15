import { NextResponse } from "next/server";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "../../../../lib/supabase/server";
import {
  estabelecimentoSchema,
  toEstabelecimentoRow,
} from "@/features/admin/estabelecimento-schema";

// GET /api/admin/estabelecimentos — lista todos os tenants (Super Admin).
export async function GET() {
  const guard = await apiSession(["super_admin"]);
  if (guard.response) return guard.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estabelecimentos")
    .select("*")
    .order("nome", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
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
