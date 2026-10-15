import { requireRole } from "@/lib/auth/session";
import { PortalQr } from "@/features/portal/portal-qr";

export const metadata = { title: "Meu QR Code" };

export default async function PortalQrPage() {
  await requireRole(["cliente"]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold">Meu QR Code</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Apresente o QR Code no check-in de cada evento.
      </p>
      <PortalQr />
    </div>
  );
}
