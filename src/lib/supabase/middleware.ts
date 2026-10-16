import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database, Profile } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/env";
import { canAccessPath, homePathForRole, normalizeRole, ruleForPath } from "@/lib/auth/roles";

// Rotas que não devem ser acessadas quando já autenticado.
const AUTH_PREFIXES = ["/login", "/onboarding"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

// Renova a sessão do Supabase a cada navegação e aplica o controle de acesso
// por papel (RBAC) + tenant. O service worker NÃO tenta refresh em background:
// quando volta online, a próxima navegação passa por aqui e a sessão é renovada.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Sem Supabase configurado (ex.: build/preview sem env) não há sessão a renovar.
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const regra = ruleForPath(pathname);

  // 1) Rota protegida sem sessão -> login.
  if (!user && regra) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Sem usuário e rota pública: nada a validar.
  if (!user) return response;

  // 2) Autenticado não deve ver telas de login/onboarding.
  if (AUTH_PREFIXES.some((p) => matchesPrefix(pathname, p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 3) Identifica papel + tenant e aplica o controle de acesso (RBAC).
  if (regra) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    const role = normalizeRole(profile?.papel);

    if (!canAccessPath(role, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = homePathForRole(role);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
