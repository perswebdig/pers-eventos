import { requireRole } from "@/lib/auth/session";
import { PortalEventos } from "@/features/portal/portal-eventos";

export const metadata = { title: "Eventos" };

export default async function PortalEventosPage() {
  await requireRole(["cliente"]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold">Eventos</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Inscreva-se nos eventos abertos do seu estabelecimento.
      </p>
      <PortalEventos />
    </div>
  );
}
