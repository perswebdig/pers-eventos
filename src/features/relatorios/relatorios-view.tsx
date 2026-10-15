"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Users,
  CalendarDays,
  ClipboardList,
  FileText,
  Activity,
  Download,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, LoadingSkeleton } from "@/components/empty-state";
import {
  getPessoasResumo,
  getEventosResumo,
  getInscricoesResumo,
  getTermosResumo,
  getLogsAcessoResumo,
  getCheckinsPorDia,
  exportarPessoasCSV,
  exportarEventosCSV,
  exportarInscricoesCSV,
  exportarTermosCSV,
  exportarLogsAcessoCSV,
} from "@/db/repos/relatorios";
import { formatDate } from "@/lib/format";

function SummaryCard({ title, value, icon: Icon, subtitle, trend }: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  subtitle?: string;
  trend?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          {subtitle}
          {trend && <span className="ml-2 text-green-600">{trend}</span>}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ label, count, color = "secondary" }: { label: string; count: number; color?: string }) {
  const tones: Record<string, string> = {
    secondary: "bg-secondary text-secondary-foreground",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  };
  return (
    <Badge variant="secondary" className={`${tones[color] ?? tones.secondary} gap-1`}>
      {label} <span className="font-mono">{count}</span>
    </Badge>
  );
}

function ExportButton({ onClick, disabled, label = "Exportar CSV" }: { onClick: () => Promise<void>; disabled?: boolean; label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Download className="size-4" /> {label}
    </Button>
  );
}

function PessoaResumoTab({ resumo }: { resumo: Awaited<ReturnType<typeof getPessoasResumo>> }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Total de pessoas" value={resumo.total} icon={Users} subtitle="Cadastradas" />
        <SummaryCard title="Com CPF" value={resumo.comCpf} icon={FileText} subtitle="Documentados" />
        <SummaryCard title="Menores de 18" value={resumo.menores} icon={Users} subtitle="Requer responsável" />
        <SummaryCard title="Consentimento LGPD" value={resumo.consentimentoLgpd} icon={ClipboardList} subtitle="Aceitos" />
      </div>
      <Separator />
      <div className="flex flex-wrap gap-2">
        {Object.entries(resumo.porStatusSync).map(([status, count]) => (
          <StatusBadge key={status} label={status} count={count}
            color={status === "synced" ? "green" : status === "pending" ? "amber" : status === "conflict" ? "red" : "gray"}
          />
        ))}
      </div>
    </div>
  );
}

function EventoResumoTab({ resumo }: { resumo: Awaited<ReturnType<typeof getEventosResumo>> }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Total de eventos" value={resumo.total} icon={CalendarDays} subtitle="Criados" />
        <SummaryCard title="Capacidade total" value={resumo.capacidadeTotal} icon={Users} subtitle="Vagas oferecidas" />
        <SummaryCard title="Vagas preenchidas" value={resumo.vagasPreenchidas} icon={ClipboardList} subtitle="Inscrições" />
        <SummaryCard title="Taxa de ocupação" value={resumo.capacidadeTotal > 0 ? Math.round((resumo.vagasPreenchidas / resumo.capacidadeTotal) * 100) + "%" : "—"} icon={Activity} subtitle="Média geral" />
      </div>
      <Separator />
      <div className="flex flex-wrap gap-2">
        {Object.entries(resumo.porStatus).map(([status, count]) => (
          <StatusBadge key={status} label={status} count={count}
            color={status === "realizado" ? "green" : status === "lotado" ? "amber" : status === "cancelado" ? "red" : "blue"}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(resumo.porStatusSync).map(([status, count]) => (
          <StatusBadge key={status} label={status} count={count}
            color={status === "synced" ? "green" : status === "pending" ? "amber" : status === "conflict" ? "red" : "gray"}
          />
        ))}
      </div>
    </div>
  );
}

function InscricaoResumoTab({ resumo }: { resumo: Awaited<ReturnType<typeof getInscricoesResumo>> }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <SummaryCard title="Total de inscrições" value={resumo.total} icon={ClipboardList} subtitle="Registradas" />
        <SummaryCard title="Check-ins" value={resumo.checkinsRealizados} icon={Activity} subtitle="Entradas" />
        <SummaryCard title="Check-outs" value={resumo.checkoutsRealizados} icon={Activity} subtitle="Saídas" />
        <SummaryCard title="Presentes agora" value={resumo.checkinsRealizados - resumo.checkoutsRealizados} icon={Users} subtitle="No local" />
        <SummaryCard title="Termos assinados" value={resumo.total - (resumo.porStatus["inscrito"] ?? 0) - (resumo.porStatus["cancelado"] ?? 0)} icon={FileText} subtitle="Compliance" />
      </div>
      <Separator />
      <div className="flex flex-wrap gap-2">
        {Object.entries(resumo.porStatus).map(([status, count]) => (
          <StatusBadge key={status} label={status} count={count}
            color={status === "checkin" ? "green" : status === "checkout" ? "blue" : status === "confirmado" ? "purple" : status === "cancelado" ? "red" : "gray"}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(resumo.porPagamento).map(([status, count]) => (
          <StatusBadge key={status} label={status} count={count} color="purple" />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(resumo.porStatusSync).map(([status, count]) => (
          <StatusBadge key={status} label={status} count={count}
            color={status === "synced" ? "green" : status === "pending" ? "amber" : status === "conflict" ? "red" : "gray"}
          />
        ))}
      </div>
    </div>
  );
}

function TermoResumoTab({ resumo }: { resumo: Awaited<ReturnType<typeof getTermosResumo>> }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SummaryCard title="Total de termos" value={resumo.total} icon={FileText} subtitle="Aceitos" />
        <SummaryCard title="Responsabilidade" value={resumo.porTipo.responsabilidade ?? 0} icon={ClipboardList} subtitle="Termos" />
        <SummaryCard title="Uso de imagem" value={resumo.porTipo.imagem ?? 0} icon={FileText} subtitle="Termos" />
      </div>
      <Separator />
      <div className="flex flex-wrap gap-2">
        {Object.entries(resumo.porStatusSync).map(([status, count]) => (
          <StatusBadge key={status} label={status} count={count}
            color={status === "synced" ? "green" : status === "pending" ? "amber" : status === "conflict" ? "red" : "gray"}
          />
        ))}
      </div>
    </div>
  );
}

function LogAcessoResumoTab({ resumo }: { resumo: Awaited<ReturnType<typeof getLogsAcessoResumo>> }) {
  return (
    <div className="space-y-4">
      <SummaryCard title="Total de acessos" value={resumo.total} icon={Activity} subtitle="Registrados" />
      <Separator />
      <div className="flex flex-wrap gap-2">
        {Object.entries(resumo.porAcao).map(([acao, count]) => (
          <StatusBadge key={acao} label={acao} count={count} color="purple" />
        ))}
      </div>
      <Separator />
      <h4 className="text-sm font-medium">Últimos 30 dias</h4>
      <div className="h-48 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-2">Data</th>
              <th className="pb-2 text-right">Acessos</th>
            </tr>
          </thead>
          <tbody>
            {resumo.ultimosDias.slice().reverse().map(({ data, count }) => (
              <tr key={data} className="border-t">
                <td className="py-1">{formatDate(data)}</td>
                <td className="py-1 text-right font-mono">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RelatoriosDashboard() {
  const pessoasResumo = useLiveQuery(() => getPessoasResumo(), []);
  const eventosResumo = useLiveQuery(() => getEventosResumo(), []);
  const inscricoesResumo = useLiveQuery(() => getInscricoesResumo(), []);
  const termosResumo = useLiveQuery(() => getTermosResumo(), []);
  const logsResumo = useLiveQuery(() => getLogsAcessoResumo(), []);
  const checkinsPorDia = useLiveQuery(() => getCheckinsPorDia(30), []);
  const [exportando, setExportando] = useState(false);

  async function handleExport(fn: () => Promise<string>, filename: string) {
    setExportando(true);
    try {
      const csv = await fn();
      if (!csv) {
        toast.info("Nenhum dado para exportar");
        return;
      }
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${filename} baixado`);
    } catch {
      toast.error("Falha ao exportar");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral e exportação dos dados offline. Todos os números vêm do IndexedDB local.
          </p>
        </div>
      </div>

      <Tabs defaultValue="pessoas" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="pessoas"><Users className="size-4 mr-1" /> Pessoas</TabsTrigger>
          <TabsTrigger value="eventos"><CalendarDays className="size-4 mr-1" /> Eventos</TabsTrigger>
          <TabsTrigger value="inscricoes"><ClipboardList className="size-4 mr-1" /> Inscrições</TabsTrigger>
          <TabsTrigger value="termos"><FileText className="size-4 mr-1" /> Termos</TabsTrigger>
          <TabsTrigger value="logs"><Activity className="size-4 mr-1" /> Logs LGPD</TabsTrigger>
          <TabsTrigger value="grafico"><BarChart2 className="size-4 mr-1" /> Gráfico</TabsTrigger>
        </TabsList>

        <TabsContent value="pessoas">
          {pessoasResumo === undefined ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <PessoaResumoTab resumo={pessoasResumo as Awaited<ReturnType<typeof getPessoasResumo>>} />
          )}
          <Separator />
          <ExportButton onClick={() => handleExport(exportarPessoasCSV, "pessoas.csv")} disabled={exportando} />
        </TabsContent>

        <TabsContent value="eventos">
          {eventosResumo === undefined ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <EventoResumoTab resumo={eventosResumo as Awaited<ReturnType<typeof getEventosResumo>>} />
          )}
          <Separator />
          <ExportButton onClick={() => handleExport(exportarEventosCSV, "eventos.csv")} disabled={exportando} />
        </TabsContent>

        <TabsContent value="inscricoes">
          {inscricoesResumo === undefined ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <InscricaoResumoTab resumo={inscricoesResumo as Awaited<ReturnType<typeof getInscricoesResumo>>} />
          )}
          <Separator />
          <ExportButton onClick={() => handleExport(exportarInscricoesCSV, "inscricoes.csv")} disabled={exportando} />
        </TabsContent>

        <TabsContent value="termos">
          {termosResumo === undefined ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <TermoResumoTab resumo={termosResumo as Awaited<ReturnType<typeof getTermosResumo>>} />
          )}
          <Separator />
          <ExportButton onClick={() => handleExport(exportarTermosCSV, "termos.csv")} disabled={exportando} />
        </TabsContent>

        <TabsContent value="logs">
          {logsResumo === undefined ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <LogAcessoResumoTab resumo={logsResumo as Awaited<ReturnType<typeof getLogsAcessoResumo>>} />
          )}
          <Separator />
          <ExportButton onClick={() => handleExport(exportarLogsAcessoCSV, "logs-acesso.csv")} disabled={exportando} />
        </TabsContent>

        <TabsContent value="grafico">
          <CheckinsChart />
</TabsContent>
      </Tabs>
    </div>
  );
}

function CheckinsChart() {
  const dados = useLiveQuery(() => getCheckinsPorDia(30), []);

  if (dados === undefined) {
    return <LoadingSkeleton count={1} />;
  }

  const maxCheckins = Math.max(...dados.map((d) => d.checkins), 1);
  const maxCheckouts = Math.max(...dados.map((d) => d.checkouts), 1);
  const maxTotal = Math.max(maxCheckins, maxCheckouts);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart2 className="size-5" /> Check-ins / Check-outs por dia (últimos 30 dias)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {dados.map((d) => (
            <div key={d.data} className="flex items-center gap-3">
              <span className="w-24 text-xs text-muted-foreground font-mono">{formatDate(d.data)}</span>
              <div className="flex-1 h-6 bg-muted rounded relative overflow-hidden">
                {d.checkins > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-green-500 rounded-l"
                    style={{ width: `${(d.checkins / maxTotal) * 100}%` }}
                    title={`Check-ins: ${d.checkins}`}
                  />
                )}
                {d.checkouts > 0 && (
                  <div
                    className="absolute inset-y-0 bg-blue-500 rounded-r"
                    style={{
                      left: `${(d.checkins / maxTotal) * 100}%`,
                      width: `${(d.checkouts / maxTotal) * 100}%`,
                    }}
                    title={`Check-outs: ${d.checkouts}`}
                  />
                )}
              </div>
              <span className="w-20 text-xs text-right font-mono">
                {d.checkins ? <span className="text-green-600">↑{d.checkins}</span> : "—"}
                {d.checkouts ? <span className="text-blue-600 ml-1">↓{d.checkouts}</span> : "—"}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded" /> Check-ins</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded" /> Check-outs</span>
        </div>
      </CardContent>
    </Card>
  );
}