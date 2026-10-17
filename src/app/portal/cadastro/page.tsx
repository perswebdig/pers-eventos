import { requireEstabelecimento } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { PortalPerfilForm } from "@/features/portal/portal-perfil-form";
import { SeletorEstabelecimento } from "@/features/portal/seletor-estabelecimento";

export const metadata = { title: "Meu cadastro" };

export default async function PortalCadastroPage() {
  const ctx = await requireEstabelecimento();

  return (
    <PageContainer width="form">
      <PageHeader
        title="Meu cadastro"
        description="Preencha seus dados e aceite os termos de LGPD para participar dos eventos."
      />

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estabelecimento</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {ctx.estabelecimento?.nome ?? "Nenhum selecionado"}
              <span className="block text-xs text-muted-foreground">
                Define os eventos e ingressos que você vê no portal.
              </span>
            </p>
            <SeletorEstabelecimento
              modo="trocar"
              atualId={ctx.tenantId}
              atualNome={ctx.estabelecimento?.nome ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados pessoais</CardTitle>
          </CardHeader>
          <CardContent>
            <PortalPerfilForm />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
