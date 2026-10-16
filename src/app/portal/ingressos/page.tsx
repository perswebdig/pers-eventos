import { requireRole } from "@/lib/auth/session";
import { PortalIngressos } from "@/features/portal/portal-ingressos";

export const metadata = { title: "Meus Ingressos" };

export default async function PortalIngressosPage() {
  await requireRole(["cliente"]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Meus Ingressos</h1>
      <PortalIngressos />
    </div>
  );
}
