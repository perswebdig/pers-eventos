import Link from "next/link";
import { CalendarDays, MapPin, QrCode, Ticket, UserRound } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Meu espaço" };

const ATALHOS = [
  {
    href: "/portal/eventos",
    label: "Eventos",
    description: "Veja os eventos abertos e faça sua inscrição.",
    icon: CalendarDays,
  },
  {
    href: "/portal/ingressos",
    label: "Meus Ingressos",
    description: "Seus QR Codes de entrada ficam guardados aqui.",
    icon: Ticket,
  },
  {
    href: "/portal/qr",
    label: "Meu QR Code",
    description: "Apresente na recepção para o check-in rápido.",
    icon: QrCode,
  },
];

export default async function PortalIndexPage() {
  const ctx = await requireRole(["cliente"]);

  return (
    <PageContainer width="content">
      <PageHeader
        title={`Olá, ${ctx.nome ?? ctx.email ?? "cliente"}!`}
        description={
          ctx.estabelecimento
            ? `Você é cliente de ${ctx.estabelecimento.nome}.`
            : "Bem-vindo ao portal do cliente."
        }
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

      <div className="grid gap-3 sm:grid-cols-3">
        {ATALHOS.map((atalho) => {
          const Icon = atalho.icon;
          return (
            <Link key={atalho.href} href={atalho.href} className="group block h-full">
              <Card className="h-full gap-3 p-4 transition-colors group-hover:ring-primary/30">
                <CardContent className="flex flex-col gap-3 px-0">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                    <Icon className="size-4.5" />
                  </span>
                  <span className="space-y-1">
                    <span className="block font-medium">{atalho.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {atalho.description}
                    </span>
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {ctx.estabelecimento?.endereco ? (
        <p className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3.5" />
          {ctx.estabelecimento.endereco}
        </p>
      ) : null}
    </PageContainer>
  );
}
