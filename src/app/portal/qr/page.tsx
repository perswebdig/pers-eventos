import { requireEstabelecimento } from "@/lib/auth/session";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { PortalQr } from "@/features/portal/portal-qr";

export const metadata = { title: "Meu QR Code" };

export default async function PortalQrPage() {
  await requireEstabelecimento();
  return (
    <PageContainer width="content">
      <PageHeader
        title="Meu QR Code"
        description="Apresente o QR Code no check-in de cada evento."
      />
      <PortalQr />
    </PageContainer>
  );
}
