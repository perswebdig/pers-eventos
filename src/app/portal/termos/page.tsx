import { requireEstabelecimento } from "@/lib/auth/session";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { PortalTermos } from "@/features/portal/portal-termos";

export const metadata = { title: "Termos & LGPD" };

export default async function PortalTermosPage() {
  await requireEstabelecimento();
  return (
    <PageContainer width="content">
      <PageHeader
        title="Termos & LGPD"
        description="Aceite os termos de responsabilidade e de uso de imagem."
      />
      <PortalTermos />
    </PageContainer>
  );
}
