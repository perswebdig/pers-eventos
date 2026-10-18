"use client";

import { useEffect, useMemo, useState } from "react";
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
import { formatDate } from "@/lib/format";

interface PessoasResumo {
  total: number;
  comCpf: number;
  menores: number;
  adultos: number;
  consentimentoLgpd: number;
}

interface EventosResumo {
  total: number;
  porStatus: Record<string, number>;
  capacidadeTotal: number;
  vagasPreenchidas: number;
}

interface InscricoesResumo {
  total: number;
  porStatus: Record<string, number>;
  porPagamento: Record<string, number>;
  checkinsRealizados: number;
  checkoutsRealizados: number;
}

interface TermosResumo {
  total: number;
  porTipo: Record<string, number>;
}

interface LogsResumo {
  total: number;
  porAcao: Record<string, number>;
  ultimosDias: Array<{ data: string; count: number }>;
}

interface ResumoRelatorios {
  pessoas: PessoasResumo;
  eventos: EventosResumo;
  inscricoes: InscricoesResumo;
  termos: TermosResumo;
  logs: LogsResumo;
  checkinsPorDia: Array<{ data: string; checkins: number; checkouts: number }>;
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

function ExportButton({ onClick, disabled }: { onClick: () => Promise<void>; disabled?: boolean }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Download className="size-4" /> Exportar CSV
    </Button>
  );
}

function PessoaResumoTab({ resumo }: { resumo: PessoasResumo }) {
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
    </div>
  );
}

function EventoResumoTab({ resumo }: { resumo: EventosResumo }) {
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
    </div>
  );
}

function InscricaoResumoTab({ resumo }: { resumo: InscricoesResumo }) {
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
      <div className="flex flex-wrap gap-2">
        {Object.entries(resumo.porPagamento).map(([status, count]) => (
          <CountPill key={status} label={status} count={count} tone={pagamentoTone(status)} />
        ))}
      </div>
    </div>
  );
}

function TermoResumoTab({ resumo }: { resumo: TermosResumo }) {
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
    </div>
  );
}

function LogAcessoResumoTab({ resumo }: { resumo: LogsResumo }) {
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
  checkinsPorDia,
}: {
  inscricoesResumo: InscricoesResumo | null;
  checkinsPorDia: Array<{ data: string; checkins: number; checkouts: number }> | null;
}) {
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
          {checkinsPorDia === null ? (
            <LoadingSkeleton count={1} />
          ) : checkinsPorDia.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum check-in ou check-out nos últimos 30 dias.
            </p>
          ) : (
            <CheckinsChart dados={checkinsPorDia} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inscrições por status</CardTitle>
        </CardHeader>
        <CardContent>
          {inscricoesResumo === null ? (
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
  const [resumo, setResumo] = useState<ResumoRelatorios | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    let ativo = true;
    fetch("/api/relatorios")
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao carregar");
        return (body as { data: ResumoRelatorios }).data;
      })
      .then((data) => {
        if (ativo) setResumo(data);
      })
      .catch((err: Error) => {
        if (ativo) setErro(err.message);
      });
    return () => {
      ativo = false;
    };
  }, []);

  async function handleExport(tipo: string) {
    setExportando(true);
    try {
      const res = await fetch(`/api/relatorios/exportar?tipo=${tipo}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Falha ao exportar");
      }
      const csv = await res.text();
      if (!csv) {
        toast.info("Nenhum dado para exportar");
        return;
      }
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tipo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${tipo}.csv baixado`);
    } catch (err) {
      toast.error("Falha ao exportar", { description: (err as Error).message });
    } finally {
      setExportando(false);
    }
  }

  if (erro) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm font-medium">Não foi possível carregar os relatórios</p>
          <p className="text-sm text-muted-foreground">{erro}</p>
        </CardContent>
      </Card>
    );
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
        {resumo === null ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <PessoaResumoTab resumo={resumo.pessoas} />
        )}
        <Separator />
        <div className="flex justify-end">
          <ExportButton onClick={() => handleExport("pessoas")} disabled={exportando} />
        </div>
      </TabsContent>

      <TabsContent value="eventos" className="space-y-4">
        {resumo === null ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <EventoResumoTab resumo={resumo.eventos} />
        )}
        <Separator />
        <div className="flex justify-end">
          <ExportButton onClick={() => handleExport("eventos")} disabled={exportando} />
        </div>
      </TabsContent>

      <TabsContent value="inscricoes" className="space-y-4">
        {resumo === null ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <InscricaoResumoTab resumo={resumo.inscricoes} />
        )}
        <Separator />
        <div className="flex justify-end">
          <ExportButton onClick={() => handleExport("inscricoes")} disabled={exportando} />
        </div>
      </TabsContent>

      <TabsContent value="termos" className="space-y-4">
        {resumo === null ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <TermoResumoTab resumo={resumo.termos} />
        )}
        <Separator />
        <div className="flex justify-end">
          <ExportButton onClick={() => handleExport("termos")} disabled={exportando} />
        </div>
      </TabsContent>

      <TabsContent value="logs" className="space-y-4">
        {resumo === null ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <LogAcessoResumoTab resumo={resumo.logs} />
        )}
        <Separator />
        <div className="flex justify-end">
          <ExportButton onClick={() => handleExport("logs")} disabled={exportando} />
        </div>
      </TabsContent>

      <TabsContent value="grafico">
        <GraficosTab
          inscricoesResumo={resumo?.inscricoes ?? null}
          checkinsPorDia={resumo?.checkinsPorDia ?? null}
        />
      </TabsContent>
    </Tabs>
  );
}
