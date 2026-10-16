import { requireRole } from "@/lib/auth/session";
import { AppHeader } from "@/components/app-header";

export default async function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ctx = await requireRole(["cliente"]);
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader email={ctx.email} role={ctx.role} />
      <main id="main-content" className="flex-1 pt-1">
        {children}
      </main>
    </div>
  );
}
