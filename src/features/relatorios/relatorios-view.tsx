"use client";

import { useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { LoadingSkeleton } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Donut } from "@/components/charts";
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

function syncTone(status: string): StatusTone {
  if (status === "synced") return "success";
  if (status === "pending") return "warning";
  if (status === "conflict" || status === "error") return "danger";
  return "neutral";
}

function eventoStatusTone(status: string): StatusTone {
  if (status === "realizado") return "success";
  if (status === "lotado") return "warning";
  if (status === "cancelado") return "danger";
  return "info";
}

function inscricaoStatusTone(status: string): StatusTone {
  if (status === "checkin") return "success";
  if (status === "checkout") return "info";
  if (status === "confirmado") return "primary";
  if (status === "cancelado") return "danger";
  return "neutral";
}

function pagamentoTone(status: string): StatusTone {
  if (status === "pago" || status === "paid") return "success";
  if (status === "pendente" || status === "pending") return "warning";
  if (status === "estornado" || status === "refunded") return "info";
  return "primary";
}

function CountPill({
  label,
  count,
  tone = "neutral",
}: {
  label: string;
  count: number;
  tone?: StatusTone;
}) {
  return (
    <StatusBadge tone={tone} className="gap-1">
      {label} <span className="font-mono">{count}</span>
    </StatusBadge>
  );
}

function ExportButton({
  onClick,
  disabled,
  label = "Exportar CSV",
}: {
  onClick: () => Promise<void>;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Download className="size-4" /> {label}
    </Button>
  );
}

function PessoaResumoTab({ resumo }: { resumo: Awaited<ReturnType<typeof getPessoasResumo>> }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de pessoas" value={resumo.total} hint="Cadastradas" icon={Users} />
        <StatCard
          label="Com CPF"
          value={resumo.comCpf}
          hint="Documentados"
          icon={FileText}
          tone="info"
        />
        <StatCard
          label="Menores de 18"
          value={resumo.menores}
          hint="Requer responsável"
          icon={Users}
          tone="warning"
        />
        <StatCard
          label="Consentimento LGPD"
          value={resumo.consentimentoLgpd}
          hint="Aceitos"
          icon={ClipboardList}
          tone="success"
        />
      </div>
      <Separator />
      <div className="flex flex-wrap gap-2">
        {Object.entries(resumo.porStatusSync).map(([status, count]) => (
          <CountPill key={status} label={status} count={count} tone={syncTone(status)} />
        ))}
      </div>
    </div>
  );
}

function EventoResumoTab({ resumo }: { resumo: Awaited<ReturnType<typeof getEventosResumo>> }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total de eventos"
          value={resumo.total}
          hint="Criados"
          icon={CalendarDays}
        />
        <StatCard
          label="Capacidade total"
          value={resumo.capacidadeTotal}
          hint="Vagas oferecidas"
          icon={Users}
          tone="info"
        />
        <StatCard
          label="Vagas preenchidas"
          value={resumo.vagasPreenchidas}
          hint="Inscrições"
          icon={ClipboardList}
          tone="primary"
        />
        <StatCard
          label="Taxa de ocupação"
          value={
            resumo.capacidadeTotal > 0
              ? Math.round((resumo.vagasPreenchidas / resumo.capacidadeTotal) * 100) + "%"
              : "—"
          }
          hint="Média geral"
          icon={Activity}
          tone="success"
        />
      </div>
      <Separator />
      <div className="flex flex-wrap gap-2">
        {Object.entries(resumo.porStatus).map(([status, count]) => (
          <CountPill key={status} label={status} count={count} tone={eventoStatusTone(status)} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(resumo.porStatusSync).map(([status, count]) => (
          <CountPill key={status} label={status} count={count} tone={syncTone(status)} />
        ))}
      </div>
    </div>
  );
}

function InscricaoResumoTab({
  resumo,
}: {
  resumo: Awaited<ReturnType<typeof getInscricoesResumo>>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total de inscrições"
          value={resumo.total}
          hint="Registradas"
          icon={ClipboardList}
        />
        <StatCard
          label="Check-ins"
          value={resumo.checkinsRealizados}
          hint="Entradas"
          icon={Activity}
          tone="success"
        />
        <StatCard
          label="Check-outs"
          value={resumo.checkoutsRealizados}
          hint="Saídas"
          icon={Activity}
          tone="info"
        />
        <StatCard
          label="Presentes agora"
          value={resumo.checkinsRealizados - resumo.checkoutsRealizados}
          hint="No local"
          icon={Users}
          tone="primary"
        />
        <StatCard
          label="Termos assinados"
          value={
            resumo.total -
            (resumo.porStatus["inscrito"] ?? 0) -
            (resumo.porStatus["cancelado"] ?? 0)
          }
          hint="Compliance"
          icon={FileText}
          tone="success"
        />
      </div>
      <Separator />
      <div className="flex flex-wrap gap-2">
        {Object.entries(resumo.porStatus).map(([status, count]) => (
          <CountPill key={status} label={status} count={count} tone={inscricaoStatusTone(status)} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(resumo.porPagamento).map(([status, count]) => (
          <CountPill key={status} label={status} count={count} tone={pagamentoTone(status)} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(resumo.porStatusSync).map(([status, count]) => (
          <CountPill key={status} label={status} count={count} tone={syncTone(status)} />
        ))}
      </div>
    </div>
  );
}

function TermoResumoTab({ resumo }: { resumo: Awaited<ReturnType<typeof getTermosResumo>> }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total de termos" value={resumo.total} hint="Aceitos" icon={FileText} />
        <StatCard
          label="Responsabilidade"
          value={resumo.porTipo.responsabilidade ?? 0}
          hint="Termos"
          icon={ClipboardList}
          tone="primary"
        />
        <StatCard
          label="Uso de imagem"
          value={resumo.porTipo.imagem ?? 0}
          hint="Termos"
          icon={FileText}
          tone="info"
        />
      </div>
      <Separator />
      <div className="flex flex-wrap gap-2">
        {Object.entries(resumo.porStatusSync).map(([status, count]) => (
          <CountPill key={status} label={status} count={count} tone={syncTone(status)} />
        ))}
      </div>
    </div>
  );
}

function LogAcessoResumoTab({
  resumo,
}: {
  resumo: Awaited<ReturnType<typeof getLogsAcessoResumo>>;
}) {
  return (
    <div className="space-y-4">
      <StatCard
        label="Total de acessos"
        value={resumo.total}
        hint="Registrados"
        icon={Activity}
        className="max-w-xs"
      />
      <Separator />
      <div className="flex flex-wrap gap-2">
        {Object.entries(resumo.porAcao).map(([acao, count]) => (
          <CountPill key={acao} label={acao} count={count} tone="info" />
        ))}
      </div>
      <Separator />
      <h4 className="text-sm font-medium">Últimos 30 dias</h4>
      <div className="max-h-72 overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Acessos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resumo.ultimosDias
              .slice()
              .reverse()
              .map(({ data, count }) => (
                <TableRow key={data}>
                  <TableCell className="text-muted-foreground">{formatDate(data)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{count}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function GraficosTab({
  inscricoesResumo,
}: {
  inscricoesResumo: Awaited<ReturnType<typeof getInscricoesResumo>> | undefined;
}) {
  const dados = useLiveQuery(() => getCheckinsPorDia(30), []);

  const segmentos = useMemo(() => {
    if (!inscricoesResumo) return [];
    const porStatus = inscricoesResumo.porStatus;
    const cores: Record<string, string> = {
      inscrito: "var(--chart-1)",
      confirmado: "var(--chart-2)",
      checkin: "var(--chart-3)",
      checkout: "var(--chart-4)",
      cancelado: "var(--chart-5)",
    };
    return Object.entries(porStatus)
      .filter(([, valor]) => valor > 0)
      .map(([status, valor]) => ({
        label: status,
        value: valor,
        color: cores[status] ?? "var(--chart-1)",
      }));
  }, [inscricoesResumo]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="size-4 text-primary" /> Movimento diário (30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dados === undefined ? (
            <LoadingSkeleton count={1} />
          ) : dados.length === 0 || dados.every((d) => d.checkins === 0 && d.checkouts === 0) ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum check-in ou check-out nos últimos 30 dias.
            </p>
          ) : (
            <CheckinsChart dados={dados} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inscrições por status</CardTitle>
        </CardHeader>
        <CardContent>
          {inscricoesResumo === undefined ? (
            <Skeleton className="h-40 w-full" />
          ) : segmentos.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma inscrição registrada ainda.
            </p>
          ) : (
            <Donut segments={segmentos} centerLabel="inscrição(ões)" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CheckinsChart({
  dados,
}: {
  dados: { data: string; checkins: number; checkouts: number }[];
}) {
  const maxCheckins = Math.max(...dados.map((d) => d.checkins), 1);
  const maxCheckouts = Math.max(...dados.map((d) => d.checkouts), 1);
  const maxTotal = Math.max(maxCheckins, maxCheckouts);

  return (
    <div className="space-y-3">
      {dados.map((d) => (
        <div key={d.data} className="flex items-center gap-3">
          <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
            {formatDate(d.data)}
          </span>
          <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            {d.checkins > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-l-full bg-success"
                style={{ width: `${(d.checkins / maxTotal) * 100}%` }}
                title={`Check-ins: ${d.checkins}`}
              />
            )}
            {d.checkouts > 0 && (
              <div
                className="absolute inset-y-0 bg-chart-1"
                style={{
                  left: `${(d.checkins / maxTotal) * 100}%`,
                  width: `${(d.checkouts / maxTotal) * 100}%`,
                }}
                title={`Check-outs: ${d.checkouts}`}
              />
            )}
          </div>
          <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums">
            {d.checkins ? <span className="text-success">↑{d.checkins}</span> : "—"}
            {d.checkouts ? <span className="ml-1 text-chart-1">↓{d.checkouts}</span> : "—"}
          </span>
        </div>
      ))}
      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-success" /> Check-ins
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-chart-1" /> Check-outs
        </span>
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
    <Tabs defaultValue="pessoas" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
        <TabsTrigger value="pessoas">
          <Users className="mr-1 size-4" /> Pessoas
        </TabsTrigger>
        <TabsTrigger value="eventos">
          <CalendarDays className="mr-1 size-4" /> Eventos
        </TabsTrigger>
        <TabsTrigger value="inscricoes">
          <ClipboardList className="mr-1 size-4" /> Inscrições
        </TabsTrigger>
        <TabsTrigger value="termos">
          <FileText className="mr-1 size-4" /> Termos
        </TabsTrigger>
        <TabsTrigger value="logs">
          <Activity className="mr-1 size-4" /> Logs LGPD
        </TabsTrigger>
        <TabsTrigger value="grafico">
          <BarChart2 className="mr-1 size-4" /> Gráficos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pessoas" className="space-y-4">
        {pessoasResumo === undefined ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <PessoaResumoTab resumo={pessoasResumo as Awaited<ReturnType<typeof getPessoasResumo>>} />
        )}
        <Separator />
        <div className="flex justify-end">
          <ExportButton
            onClick={() => handleExport(exportarPessoasCSV, "pessoas.csv")}
            disabled={exportando}
          />
        </div>
      </TabsContent>

      <TabsContent value="eventos" className="space-y-4">
        {eventosResumo === undefined ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <EventoResumoTab resumo={eventosResumo as Awaited<ReturnType<typeof getEventosResumo>>} />
        )}
        <Separator />
        <div className="flex justify-end">
          <ExportButton
            onClick={() => handleExport(exportarEventosCSV, "eventos.csv")}
            disabled={exportando}
          />
        </div>
      </TabsContent>

      <TabsContent value="inscricoes" className="space-y-4">
        {inscricoesResumo === undefined ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <InscricaoResumoTab
            resumo={inscricoesResumo as Awaited<ReturnType<typeof getInscricoesResumo>>}
          />
        )}
        <Separator />
        <div className="flex justify-end">
          <ExportButton
            onClick={() => handleExport(exportarInscricoesCSV, "inscricoes.csv")}
            disabled={exportando}
          />
        </div>
      </TabsContent>

      <TabsContent value="termos" className="space-y-4">
        {termosResumo === undefined ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <TermoResumoTab resumo={termosResumo as Awaited<ReturnType<typeof getTermosResumo>>} />
        )}
        <Separator />
        <div className="flex justify-end">
          <ExportButton
            onClick={() => handleExport(exportarTermosCSV, "termos.csv")}
            disabled={exportando}
          />
        </div>
      </TabsContent>

      <TabsContent value="logs" className="space-y-4">
        {logsResumo === undefined ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <LogAcessoResumoTab
            resumo={logsResumo as Awaited<ReturnType<typeof getLogsAcessoResumo>>}
          />
        )}
        <Separator />
        <div className="flex justify-end">
          <ExportButton
            onClick={() => handleExport(exportarLogsAcessoCSV, "logs-acesso.csv")}
            disabled={exportando}
          />
        </div>
      </TabsContent>

      <TabsContent value="grafico">
        <GraficosTab inscricoesResumo={inscricoesResumo} />
      </TabsContent>
    </Tabs>
  );
}
