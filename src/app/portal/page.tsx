import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Meu espaço" };

export default async function PortalIndexPage() {
  const ctx = await requireRole(["cliente"]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold">Olá, {ctx.nome ?? ctx.email ?? "cliente"}!</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {ctx.estabelecimento
          ? `Você é cliente de ${ctx.estabelecimento.nome}.`
          : "Bem-vindo ao portal do cliente."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cadastro</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              render={
                <Link href="/portal/cadastro">
                  {ctx.pessoaId ? "Editar dados" : "Completar cadastro"}
                </Link>
              }
              size="sm"
              className="w-full"
            >
              {ctx.pessoaId ? "Editar dados" : "Completar cadastro"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              render={<Link href="/portal/eventos">Ver eventos</Link>}
              size="sm"
              variant="outline"
              className="w-full"
            >
              Ver eventos
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">QR Code</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              render={<Link href="/portal/qr">Meu QR Code</Link>}
              size="sm"
              variant="outline"
              className="w-full"
            >
              Meu QR Code
            </Button>
          </CardContent>
        </Card>
      </div>

      {!ctx.pessoaId ? (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-500">
          Complete seu cadastro para se inscrever em eventos.
        </p>
      ) : null}
    </div>
  );
}
