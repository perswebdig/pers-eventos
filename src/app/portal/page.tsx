import Link from "next/link";
import { UserRound } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { PortalEventos } from "@/features/portal/portal-eventos";

export const metadata = { title: "Início" };

export default async function PortalIndexPage() {
  const ctx = await requireRole(["cliente"]);

  return (
    <PageContainer width="content">
      <PageHeader
        title={`Olá, ${ctx.nome ?? ctx.email ?? "cliente"}!`}
        description="Descubra os eventos abertos de todos os estabelecimentos e garanta seu ingresso."
        actions={
          <Button
            variant={ctx.pessoaId ? "outline" : "default"}
            render={
              <Link href="/portal/cadastro">
                <UserRound className="size-4" />
                {ctx.pessoaId ? "Editar dados" : "Completar cadastro"}
              </Link>
            }
          />
        }
      />

      {!ctx.pessoaId ? (
        <Card className="mb-4 border-warning/40 bg-warning/5">
          <CardContent className="py-3 text-sm">
            <p className="font-medium text-warning">Cadastro incompleto</p>
            <p className="mt-0.5 text-muted-foreground">
              Complete seu cadastro para se inscrever em eventos e comprar ingressos.{" "}
              <Link
                href="/portal/cadastro"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Completar agora
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : null}

      <PortalEventos />
    </PageContainer>
  );
}
