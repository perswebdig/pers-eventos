import { requireRole } from "@/lib/auth/session";
import { PortalTermos } from "@/features/portal/portal-termos";

export const metadata = { title: "Termos & LGPD" };

export default async function PortalTermosPage() {
  await requireRole(["cliente"]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold">Termos &amp; LGPD</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Aceite os termos de responsabilidade e de uso de imagem.
      </p>
      <PortalTermos />
    </div>
  );
}
