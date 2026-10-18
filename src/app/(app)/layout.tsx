import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionContext, type SessionContext } from "@/lib/auth/session";
import { homePathForRole } from "@/lib/auth/roles";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let ctx: SessionContext | null = null;

  // Exigimos sessão (o middleware também protege).
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
      <AppHeader
        email={ctx?.email ?? null}
        role={ctx?.role ?? "staff"}
        tenantName={ctx?.estabelecimento?.nome ?? null}
      />
      <main
        id="main-content"
        className="flex-1 pt-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
      >
        {children}
      </main>
    </div>
  );
}
