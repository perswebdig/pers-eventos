import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalPerfilForm } from "@/features/portal/portal-perfil-form";

export const metadata = { title: "Meu cadastro" };

export default async function PortalCadastroPage() {
  const ctx = await requireRole(["cliente"]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Meu cadastro</h1>
          <p className="text-sm text-muted-foreground">
            Preencha seus dados e aceite os termos de LGPD para participar dos
            eventos.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/portal">Voltar</Link>}>
          Voltar
        </Button>
      </div>

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
    </div>
  );
}
