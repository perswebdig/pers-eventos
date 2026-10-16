import { requireRole } from "@/lib/auth/session";
import { PageContainer } from "@/components/page-container";
import { PortalCheckout } from "@/features/portal/checkout-evento";

export const metadata = { title: "Comprar ingressos" };

export default async function CheckoutEventoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["cliente"]);
  const { id } = await params;

  return (
    <PageContainer width="form">
      <PortalCheckout key={id} />
    </PageContainer>
  );
}
