import { requireEstabelecimento } from "@/lib/auth/session";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { PortalIngressos } from "@/features/portal/portal-ingressos";

export const metadata = { title: "Meus Ingressos" };

export default async function PortalIngressosPage() {
  await requireEstabelecimento();

  return (
    <PageContainer width="content">
      <PageHeader
        title="Meus Ingressos"
        description="Seus pedidos e QR Codes de entrada — apresente na recepção do evento."
      />
      <PortalIngressos />
    </PageContainer>
  );
}
