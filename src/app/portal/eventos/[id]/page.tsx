import { requireRole } from "@/lib/auth/session";
import { PortalCheckout } from "@/features/portal/checkout-evento";

export const metadata = { title: "Comprar ingressos" };

export default async function CheckoutEventoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["cliente"]);
  const { id } = await params;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <PortalCheckout />
    </div>
  );
}
