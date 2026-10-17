import { requireEstabelecimento } from "@/lib/auth/session";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { PortalEventos } from "@/features/portal/portal-eventos";

export const metadata = { title: "Eventos" };

export default async function PortalEventosPage() {
  await requireEstabelecimento();
  return (
    <PageContainer width="content">
      <PageHeader
        title="Eventos"
        description="Inscreva-se nos eventos abertos do seu estabelecimento ou garanta seu ingresso."
      />
      <PortalEventos />
    </PageContainer>
  );
}
