import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Estabelecimento, Papel, Profile } from "@/types/database";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { type AppRole, homePathForRole, normalizeRole } from "@/lib/auth/roles";

export interface SessionContext {
  userId: string;
  email: string | null;
  nome: string | null;
  papel: Papel | null;
  role: AppRole;
  tenantId: string | null;
  pessoaId: string | null;
  profile: Profile | null;
  estabelecimento: Estabelecimento | null;
  isSuperAdmin: boolean;
  isTenantAdmin: boolean;
  isStaff: boolean;
  isCliente: boolean;
}

function toContext(
  userId: string,
  email: string | null,
  profile: Profile | null,
  estabelecimento: Estabelecimento | null,
): SessionContext {
  const role = normalizeRole(profile?.papel);
  return {
    userId,
    email: email ?? profile?.email ?? null,
    nome: profile?.nome ?? null,
    papel: profile?.papel ?? null,
    role,
    tenantId: profile?.tenant_id ?? null,
    pessoaId: profile?.pessoa_id ?? null,
    profile,
    estabelecimento,
    isSuperAdmin: role === "super_admin",
    isTenantAdmin: role === "tenant_admin",
    isStaff: role === "staff",
    isCliente: role === "cliente",
  };
}

// Lê o usuário autenticado, seu perfil (papel) e o estabelecimento (tenant).
// Memoizado por requisição para evitar consultas repetidas no mesmo render.
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // select("*") é intencional: permanece válido mesmo se a migration
  // multitenant ainda não tiver sido aplicada (sem colunas novas).
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  let estabelecimento: Estabelecimento | null = null;
  if (profile?.tenant_id) {
    const { data } = await supabase
      .from("estabelecimentos")
      .select("*")
      .eq("id", profile.tenant_id)
      .maybeSingle<Estabelecimento>();
    estabelecimento = data ?? null;
  }

  return toContext(user.id, user.email ?? null, profile ?? null, estabelecimento);
});

// Exige sessão; redireciona para /login quando ausente.
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  return ctx;
}

// Exige que o usuário tenha um dos papéis informados.
export async function requireRole(allowed: readonly AppRole[]): Promise<SessionContext> {
  const ctx = await requireSession();
  if (!allowed.includes(ctx.role)) {
    redirect(homePathForRole(ctx.role));
  }
  return ctx;
}

// Exige que o usuário pertença a um estabelecimento (tenant_admin, staff ou
// cliente). Super Admin não opera dados de tenant.
export async function requireTenant(): Promise<SessionContext & { tenantId: string }> {
  const ctx = await requireSession();
  if (!ctx.tenantId) {
    redirect(ctx.isSuperAdmin ? "/admin" : "/login");
  }
  return ctx as SessionContext & { tenantId: string };
}
