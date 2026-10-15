import { NextResponse } from "next/server";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/env.server";
import { usuarioUpdateSchema } from "@/features/admin/usuario-schema";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/usuarios/:id — altera papel, status e vínculo (Admin do Estabelecimento).
export async function PATCH(request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "super_admin"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;
  const { id } = await params;

  const { data, response } = await parseBody(request, usuarioUpdateSchema);
  if (response) return response;

  if (!isSupabaseAdminConfigured) {
    return jsonError(
      "Operação indisponível: SUPABASE_SECRET_KEY (service role) não configurada.",
      503,
    );
  }

  const supabase = await createClient();

  // Isolamento: garante que o alvo pertence ao tenant do solicitante.
  if (!ctx.isSuperAdmin) {
    const { data: target } = await supabase
      .from("profiles")
      .select("id, tenant_id")
      .eq("id", id)
      .maybeSingle();
    if (!target || target.tenant_id !== ctx.tenantId) {
      return jsonError("Usuário não encontrado neste estabelecimento.", 404);
    }
  }

  const patch = data!;
  const update = {
    ...(patch.nome !== undefined ? { nome: patch.nome } : {}),
    ...(patch.papel !== undefined ? { papel: patch.papel } : {}),
    ...(patch.ativo !== undefined ? { ativo: patch.ativo } : {}),
    ...(patch.pessoa_id !== undefined
      ? { pessoa_id: patch.pessoa_id ? patch.pessoa_id : null }
      : {}),
  };

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("profiles")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: updated });
}

// DELETE /api/usuarios/:id — remove o usuário (auth + perfil).
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "super_admin"]);
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;
  const { id } = await params;

  if (ctx.userId === id) {
    return jsonError("Você não pode remover o próprio usuário.", 400);
  }

  if (!isSupabaseAdminConfigured) {
    return jsonError(
      "Operação indisponível: SUPABASE_SECRET_KEY (service role) não configurada.",
      503,
    );
  }

  const supabase = await createClient();
  if (!ctx.isSuperAdmin) {
    const { data: target } = await supabase
      .from("profiles")
      .select("id, tenant_id")
      .eq("id", id)
      .maybeSingle();
    if (!target || target.tenant_id !== ctx.tenantId) {
      return jsonError("Usuário não encontrado neste estabelecimento.", 404);
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ ok: true });
}
