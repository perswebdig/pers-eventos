import Link from "next/link";
import {
  Users,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  TrendingUp,
  Ticket,
} from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Painel" };

async function contar(tabela: "pessoas" | "eventos" | "inscricoes" | "termos", tenantId: string) {
  if (!isSupabaseConfigured) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from(tabela)
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  return count ?? 0;
}

async function contarCheckinsHoje(tenantId: string) {
  if (!isSupabaseConfigured) return 0;
  const supabase = await createClient();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const { count } = await supabase
    .from("inscricoes")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "checkin")
    .gte("data_checkin", hoje.toISOString())
    .lt("data_checkin", amanha.toISOString());
  return count ?? 0;
}

async function resumoIngressos(tenantId: string) {
  if (!isSupabaseConfigured) return { vendidos: 0, receita: 0 };
  const supabase = await createClient();
  const [{ count }, { data }] = await Promise.all([
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase.from("orders").select("total_amount").eq("tenant_id", tenantId).eq("status", "paid"),
  ]);
  const receita = (data ?? []).reduce((acc, o) => acc + Number(o.total_amount ?? 0), 0);
  return { vendidos: count ?? 0, receita };
}

async function eventosProximos(tenantId: string) {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const agora = new Date().toISOString();
  const { data } = await supabase
    .from("eventos")
    .select("id, nome, data_inicio, status")
    .eq("tenant_id", tenantId)
    .gte("data_inicio", agora)
    .in("status", ["planejado", "aberto"])
    .order("data_inicio", { ascending: true })
    .limit(5);
  return data ?? [];
}

export default async function DashboardPage() {
  const ctx = await requireTenant();

  const [
    totalPessoas,
    totalEventos,
    totalInscricoes,
    totalTermos,
    checkinsHoje,
    proximos,
    ingressos,
  ] = await Promise.all([
    contar("pessoas", ctx.tenantId),
    contar("eventos", ctx.tenantId),
    contar("inscricoes", ctx.tenantId),
    contar("termos", ctx.tenantId),
    contarCheckinsHoje(ctx.tenantId),
    eventosProximos(ctx.tenantId),
    resumoIngressos(ctx.tenantId),
  ]);

  const cards = [
    { label: "Pessoas", value: totalPessoas, icon: Users, href: "/pessoas" },
    { label: "Eventos", value: totalEventos, icon: CalendarDays, href: "/eventos" },
    { label: "Inscrições", value: totalInscricoes, icon: ClipboardList, href: "/eventos" },
    { label: "Termos aceitos", value: totalTermos, icon: CheckCircle2, href: "/termos" },
    { label: "Check-ins hoje", value: checkinsHoje, icon: TrendingUp, href: "/checkin" },
    {
      label: "Vendas de ingressos",
      value: formatCurrency(ingressos.receita),
      hint: `${ingressos.vendidos} ingresso(s) vendido(s)`,
      icon: Ticket,
      href: "/eventos",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Painel</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral do seu estabelecimento: <strong>{ctx.estabelecimento?.nome}</strong>
          </p>
        </div>
        <Button
          render={
            <Link href="/eventos">
              <CheckCircle2 className="mr-2 size-4" /> Novo evento
            </Link>
          }
          size="sm"
        >
          Novo evento
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{c.value}</p>
              {"hint" in c && c.hint ? (
                <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximos eventos</CardTitle>
        </CardHeader>
        <CardContent>
          {proximos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento agendado.</p>
          ) : (
            <ul className="space-y-2">
              {proximos.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded-lg border p-3">
                  <Link href={`/eventos`} className="font-medium">
                    {e.nome}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {new Date(e.data_inicio).toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
