import { NextResponse } from "next/server";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "../../../lib/supabase/server";
import { pessoaSchema, toPessoaRow, toMenorRow } from "@/features/pessoas/pessoa-schema";
import { ehMenor } from "@/lib/format";

// GET /api/pessoas — lista pessoas do tenant (Admin do Estabelecimento).
export async function GET() {
  const guard = await apiSession(["tenant_admin", "staff", "super_admin"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  const supabase = await createClient();
  let query = supabase.from("pessoas").select("*").order("nome_completo", { ascending: true });

  if (!ctx.isSuperAdmin && ctx.tenantId) {
    query = query.eq("tenant_id", ctx.tenantId);
  }

  const { data, error } = await query;

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/pessoas — cria pessoa no tenant do usuário.
export async function POST(request: Request) {
  const guard = await apiSession(["tenant_admin", "staff", "super_admin"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  const { data, response } = await parseBody(request, pessoaSchema);
  if (response) return response;
  const values = data!;

  const supabase = await createClient();
  const row = toPessoaRow(values);

  const tenantId = ctx.isSuperAdmin ? ctx.tenantId : ctx.tenantId;
// Super admin pode criar em qualquer tenant; se não especificado, usa o próprio
  if (!tenantId && !ctx.isSuperAdmin) {
    return jsonError("Tenant não definido.", 400);
  }

  const insertData = tenantId ? { ...row, tenant_id: tenantId } : row;

  const { data: created, error } = await supabase
    .from("pessoas")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonError("Já existe uma pessoa com este CPF.", 409);
    }
    return jsonError(error.message, 400);
  }

  // Se for menor, cria registro em menores
  if (ehMenor(values.data_nascimento)) {
    const menorRow = toMenorRow(values, created.id);
    const { error: menorError } = await supabase.from("menores").insert(menorRow);
    if (menorError) return jsonError(menorError.message, 400);
  }

  return NextResponse.json({ data: created }, { status: 201 });
}