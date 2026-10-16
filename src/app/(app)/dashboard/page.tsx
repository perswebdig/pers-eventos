import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  Plus,
  ScanLine,
  Ticket,
  Users,
} from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { BarList, Donut } from "@/components/charts";

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
    supabase.from("tickets").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
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
    .select("id, nome, data_inicio, status, capacidade")
    .eq("tenant_id", tenantId)
    .gte("data_inicio", agora)
    .in("status", ["planejado", "aberto"])
    .order("data_inicio", { ascending: true })
    .limit(5);
  return data ?? [];
}

async function inscricoesPorStatus(tenantId: string) {
  if (!isSupabaseConfigured) return {} as Record<string, number>;
  const supabase = await createClient();
  const { data } = await supabase.from("inscricoes").select("status").eq("tenant_id", tenantId);
  const porStatus: Record<string, number> = {};
  for (const row of data ?? []) {
    porStatus[row.status] = (porStatus[row.status] ?? 0) + 1;
  }
  return porStatus;
}

async function inscritosPorEvento(tenantId: string, eventoIds: string[]) {
  if (!isSupabaseConfigured || eventoIds.length === 0) return {} as Record<string, number>;
  const supabase = await createClient();
  const { data } = await supabase
    .from("inscricoes")
    .select("evento_id")
    .eq("tenant_id", tenantId)
    .in("evento_id", eventoIds);
  const contagem: Record<string, number> = {};
  for (const row of data ?? []) {
    contagem[row.evento_id] = (contagem[row.evento_id] ?? 0) + 1;
  }
  return contagem;
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
    porStatus,
  ] = await Promise.all([
    contar("pessoas", ctx.tenantId),
    contar("eventos", ctx.tenantId),
    contar("inscricoes", ctx.tenantId),
    contar("termos", ctx.tenantId),
    contarCheckinsHoje(ctx.tenantId),
    eventosProximos(ctx.tenantId),
    resumoIngressos(ctx.tenantId),
    inscricoesPorStatus(ctx.tenantId),
  ]);

  const inscritosEventos = await inscritosPorEvento(
    ctx.tenantId,
    proximos.map((e) => e.id),
  );

  const segmentos = [
    { label: "Inscrito", value: porStatus.inscrito ?? 0, color: "var(--chart-1)" },
    { label: "Confirmado", value: porStatus.confirmado ?? 0, color: "var(--chart-2)" },
    { label: "Presente", value: porStatus.checkin ?? 0, color: "var(--success)" },
    { label: "Saiu", value: porStatus.checkout ?? 0, color: "var(--chart-5)" },
    { label: "Cancelado", value: porStatus.cancelado ?? 0, color: "var(--destructive)" },
  ].filter((segmento) => segmento.value > 0);

  return (
    <PageContainer>
      <PageHeader
        title="Painel"
        description={
          <>
            Visão geral de{" "}
            <strong className="font-medium text-foreground">{ctx.estabelecimento?.nome}</strong>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              render={
                <Link href="/checkin">
                  <ScanLine className="size-4" /> Recepção
                </Link>
              }
            />
            <Button
              size="sm"
              render={
                <Link href="/eventos">
                  <Plus className="size-4" /> Novo evento
                </Link>
              }
            />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Receita de ingressos"
          value={formatCurrency(ingressos.receita)}
          hint={`${ingressos.vendidos} ingresso(s) vendido(s)`}
          icon={Banknote}
          tone="primary"
          href="/eventos"
        />
        <StatCard
          label="Check-ins hoje"
          value={checkinsHoje}
          icon={ScanLine}
          tone="success"
          href="/checkin"
        />
        <StatCard
          label="Inscrições"
          value={totalInscricoes}
          icon={ClipboardList}
          tone="info"
          href="/eventos"
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <StatCard label="Pessoas" value={totalPessoas} icon={Users} href="/pessoas" />
        <StatCard label="Eventos" value={totalEventos} icon={CalendarDays} href="/eventos" />
        <StatCard label="Termos aceitos" value={totalTermos} icon={FileCheck2} href="/termos" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Inscrições por status"
          description="Distribuição atual das inscrições do estabelecimento."
        >
          {segmentos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma inscrição registrada ainda.
            </p>
          ) : (
            <Donut
              segments={segmentos}
              centerLabel="inscrição(ões)"
              className="justify-center sm:justify-start"
            />
          )}
        </SectionCard>

        <SectionCard
          title="Próximos eventos"
          description="Ocupação de inscritos em relação à capacidade."
          actions={
            <Button variant="ghost" size="sm" render={<Link href="/eventos">Ver todos</Link>} />
          }
        >
          {proximos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Ticket className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum evento agendado.</p>
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link href="/eventos">
                    <Plus className="size-4" /> Criar evento
                  </Link>
                }
              />
            </div>
          ) : (
            <BarList
              items={proximos.map((evento) => ({
                label: (
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-medium">{evento.nome}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(evento.data_inicio).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </span>
                ),
                value: inscritosEventos[evento.id] ?? 0,
                hint: evento.capacidade ? `/ ${evento.capacidade}` : undefined,
                colorClass: "bg-chart-2",
              }))}
              max={Math.max(
                ...proximos.map((evento) => evento.capacidade ?? 0),
                ...proximos.map((evento) => inscritosEventos[evento.id] ?? 0),
                1,
              )}
            />
          )}
        </SectionCard>
      </div>
    </PageContainer>
  );
}
