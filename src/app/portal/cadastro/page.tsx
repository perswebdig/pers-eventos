import { requireRole } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { PortalPerfilForm } from "@/features/portal/portal-perfil-form";

export const metadata = { title: "Meu cadastro" };

export default async function PortalCadastroPage() {
  const ctx = await requireRole(["cliente"]);

  return (
    <PageContainer width="form">
      <PageHeader
        title="Meu cadastro"
        description="Preencha seus dados e aceite os termos de LGPD para participar dos eventos."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <PortalPerfilForm />
        </CardContent>
      </Card>

      {ctx.estabelecimento ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Estabelecimento: {ctx.estabelecimento.nome}
        </p>
      ) : null}
    </PageContainer>
  );
}
