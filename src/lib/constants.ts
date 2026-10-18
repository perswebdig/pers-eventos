import type { AppRole } from "@/lib/auth/roles";

export const APP_NAME = "PersEventos";
export const APP_DESCRIPTION =
  "Plataforma multitenant de gestão de eventos, pessoas e check-in para estabelecimentos que recebem visitantes.";

export interface NavItem {
  href: string;
  label: string;
  roles: readonly AppRole[];
}

// Navegação da área do estabelecimento (tenant).
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Painel", roles: ["tenant_admin", "staff"] },
  { href: "/pessoas", label: "Pessoas", roles: ["tenant_admin", "staff"] },
  { href: "/eventos", label: "Eventos", roles: ["tenant_admin", "staff"] },
  { href: "/pedidos", label: "Pedidos", roles: ["tenant_admin", "staff"] },
  { href: "/checkin", label: "Recepção", roles: ["tenant_admin", "staff"] },
  { href: "/termos", label: "Termos", roles: ["tenant_admin", "staff"] },
  { href: "/usuarios", label: "Usuários", roles: ["tenant_admin"] },
  { href: "/relatorios", label: "Relatórios", roles: ["tenant_admin"] },
] as const;

// Navegação do Super Admin (dono da plataforma).
export const ADMIN_NAV_ITEMS: readonly NavItem[] = [
  { href: "/admin/estabelecimentos", label: "Estabelecimentos", roles: ["super_admin"] },
] as const;

// Navegação do portal do cliente.
export const PORTAL_NAV_ITEMS: readonly NavItem[] = [
  { href: "/portal", label: "Meu espaço", roles: ["cliente"] },
  { href: "/portal/eventos", label: "Eventos", roles: ["cliente"] },
  { href: "/portal/ingressos", label: "Meus Ingressos", roles: ["cliente"] },
  { href: "/portal/qr", label: "Meu QR Code", roles: ["cliente"] },
  { href: "/portal/termos", label: "Termos", roles: ["cliente"] },
] as const;

export function navItemsForRole(role: AppRole): readonly NavItem[] {
  switch (role) {
    case "super_admin":
      return ADMIN_NAV_ITEMS;
    case "cliente":
      return PORTAL_NAV_ITEMS;
    default:
      return NAV_ITEMS;
  }
}
