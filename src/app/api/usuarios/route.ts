import { NextResponse } from "next/server";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAdminConfigured } from "@/lib/env.server";
import { usuarioCreateSchema } from "@/features/admin/usuario-schema";

// GET /api/usuarios — lista usuários do estabelecimento (RLS por tenant).
export async function GET() {
  const guard = await apiSession(["tenant_admin", "super_admin"]);
  if (guard.response) return guard.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("nome", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/usuarios — cria um usuário (staff/cliente) no estabelecimento.
// Somente Admin do Estabelecimento (ou Super Admin, informando tenant_id).
export async function POST(request: Request) {
  const guard = await apiSession(["tenant_admin", "super_admin"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  if (!isSupabaseAdminConfigured) {
    return jsonError(
      "Operação indisponível: SUPABASE_SECRET_KEY (service role) não configurada.",
      503,
    );
  }

  const { data, response } = await parseBody(request, usuarioCreateSchema);
  if (response) return response;
  const values = data!;

  const tenantId = ctx.isSuperAdmin ? values.tenant_id ?? null : ctx.tenantId;
  if (!tenantId) {
    return jsonError("Tenant não definido para o novo usuário.", 400);
  }

  const admin = createAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email: values.email,
    password: values.password,
    email_confirm: true,
    user_metadata: { nome: values.nome, tenant_id: tenantId },
  });

  if (error || !created.user) {
    return jsonError(error?.message ?? "Falha ao criar usuário.", 400);
  }

  // O trigger cria o profile como `cliente`; ajustamos papel/vínculos aqui.
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      nome: values.nome,
      email: values.email,
      papel: values.papel,
      tenant_id: tenantId,
      pessoa_id: values.pessoa_id ? values.pessoa_id : null,
    })
    .eq("id", created.user.id);

  if (updateError) {
    return jsonError(
      `Usuário criado, mas falhou ao definir o perfil: ${updateError.message}`,
      500,
    );
  }

  return NextResponse.json(
    { data: { id: created.user.id, email: created.user.email } },
    { status: 201 },
  );
}
