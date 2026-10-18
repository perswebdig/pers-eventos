import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { RelatoriosDashboard } from "@/features/relatorios/relatorios-view";

export const metadata = { title: "Relatórios" };

export default function RelatoriosPage() {
  return (
    <PageContainer width="app">
      <PageHeader
        title="Relatórios"
        description="Visão geral e exportação dos dados do estabelecimento."
      />
      <RelatoriosDashboard />
    </PageContainer>
  );
}
