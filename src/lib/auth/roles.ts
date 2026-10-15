import type { Papel } from "@/types/database";

// Papéis "de aplicação" (normalizados). O banco tem alguns valores legados
// (`admin`, `staff`, `recepcao`) que são mapeados para estes.
export type AppRole = "super_admin" | "tenant_admin" | "staff" | "cliente";

export const APP_ROLES: readonly AppRole[] = [
  "super_admin",
  "tenant_admin",
  "staff",
  "cliente",
] as const;

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Super Admin",
  tenant_admin: "Admin do Estabelecimento",
  staff: "Recepção",
  cliente: "Cliente",
};

// Normaliza o papel vindo do banco para o conjunto da aplicação.
export function normalizeRole(papel: Papel | null | undefined): AppRole {
  switch (papel) {
    case "super_admin":
      return "super_admin";
    case "tenant_admin":
    case "admin":
      return "tenant_admin";
    case "staff":
    case "recepcao":
      return "staff";
    case "cliente":
      return "cliente";
    default:
      return "cliente";
  }
}

// Rota inicial de cada papel (usada em redirecionamentos).
export function homePathForRole(role: AppRole): string {
  switch (role) {
    case "super_admin":
      return "/admin";
    case "cliente":
      return "/portal";
    default:
      return "/dashboard";
  }
}

// Regras de acesso por prefixo de rota. A ordem importa: o primeiro prefixo que
// casar define os papéis permitidos. `/admin` e `/portal` vêm antes para não
// serem capturados por prefixos mais genéricos.
export interface RouteRule {
  prefix: string;
  roles: readonly AppRole[];
}

export const ROUTE_RULES: readonly RouteRule[] = [
  { prefix: "/admin", roles: ["super_admin"] },
  { prefix: "/portal", roles: ["cliente"] },
  { prefix: "/dashboard", roles: ["tenant_admin", "staff"] },
  { prefix: "/pessoas", roles: ["tenant_admin", "staff"] },
  { prefix: "/eventos", roles: ["tenant_admin", "staff"] },
  { prefix: "/checkin", roles: ["tenant_admin", "staff"] },
  { prefix: "/termos", roles: ["tenant_admin", "staff"] },
  { prefix: "/relatorios", roles: ["tenant_admin"] },
] as const;

export function ruleForPath(pathname: string): RouteRule | null {
  return (
    ROUTE_RULES.find(
      (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
    ) ?? null
  );
}

export function canAccessPath(role: AppRole, pathname: string): boolean {
  const rule = ruleForPath(pathname);
  if (!rule) return true;
  return rule.roles.includes(role);
}

export function isRoleAllowed(
  role: AppRole | null | undefined,
  allowed: readonly AppRole[],
): boolean {
  return !!role && allowed.includes(role);
}
