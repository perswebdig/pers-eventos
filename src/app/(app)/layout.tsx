import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SyncProvider } from "@/components/sync-provider";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionContext, type SessionContext } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/auth/roles";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let ctx: SessionContext | null = null;

  // Com Supabase configurado, exigimos sessão (o middleware também protege).
  // Sem Supabase, o app roda em modo offline local.
  if (isSupabaseConfigured) {
    ctx = await getSessionContext();
    if (!ctx) redirect("/login");
    // Super Admin e cliente têm áreas próprias — não usam o painel do tenant.
    if (ctx.role === "super_admin" || ctx.role === "cliente") {
      redirect(homePathForRole(ctx.role));
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SyncProvider />
      <AppHeader
        email={ctx?.email ?? null}
        role={ctx?.role ?? "staff"}
        tenantName={ctx?.estabelecimento?.nome ?? null}
      />
      <main id="main-content" className="flex-1 pt-1">
        {children}
      </main>
    </div>
  );
}
