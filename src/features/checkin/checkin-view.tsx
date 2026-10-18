"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ScanLine, CheckCircle2, LogOut, RotateCcw, X, Circle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import {
  ScanFeedback,
  playScanBeep,
  vibrateScan,
  type ScanFeedbackData,
  type ScanFeedbackKind,
} from "./scan-feedback";
import { QrScanner, isQrScanSupported } from "./qr-scanner";
import { parseInscricaoQr, parseIngressoQr } from "./qr";
import { TicketActionCard } from "./ticket-card";
import type { InscricaoDetalhe, TicketDetalhe } from "./tipos";
import { TermoAceiteSheet } from "@/features/termos/termo-aceite-sheet";
import type { Evento, Inscricao } from "@/types/database";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "cn";

const QRGeneratorLazy = dynamic(() => import("./qr-generator").then((m) => m.QRGenerator), {
  loading: () => <div className="animate-pulse h-64 w-full" />,
  ssr: false,
});

const STATUS_LABEL: Record<string, string> = {
  inscrito: "Inscrito",
  confirmado: "Confirmado",
  checkin: "Presente",
  checkout: "Saiu",
  cancelado: "Cancelado",
};

const STATUS_TONE: Record<string, StatusTone> = {
  inscrito: "info",
  confirmado: "primary",
  checkin: "success",
  checkout: "neutral",
  cancelado: "danger",
};

function ActionCard({
  det,
  ocupado,
  onClose,
  onCheckin,
  onCheckout,
}: {
  det: InscricaoDetalhe;
  ocupado: boolean;
  onClose: () => void;
  onCheckin: () => void;
  onCheckout: () => void;
}) {
  const { inscricao, pessoa, evento } = det;
  const st = inscricao.status;
  const tone = STATUS_TONE[st] ?? "neutral";

  return (
    <Card
      className={cn(
        "relative gap-2 overflow-hidden border-l-4 p-4",
        st === "checkin" ? "border-l-warning" : "border-l-success",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
        onClick={onClose}
        aria-label="Fechar"
      >
        <X className="size-4" />
      </Button>
      <div className="grid gap-2">
        <div className="flex items-center justify-between pr-8">
          <h3 className="text-lg font-semibold">{pessoa?.nome_completo ?? "—"}</h3>
          <StatusBadge tone={tone}>{STATUS_LABEL[st] ?? st}</StatusBadge>
        </div>
        {pessoa?.cpf && <p className="text-sm text-muted-foreground">CPF: {pessoa.cpf}</p>}
        <p className="text-sm text-muted-foreground">{evento?.nome ?? "Evento não encontrado"}</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t">
          <div>
            <span className="font-medium">Check-in:</span> {formatDateTime(inscricao.data_checkin)}
          </div>
          <div>
            <span className="font-medium">Check-out:</span>{" "}
            {formatDateTime(inscricao.data_checkout)}
          </div>
        </div>
        <Separator />
        {st === "checkin" ? (
          <Button className="w-full" onClick={onCheckout} disabled={ocupado}>
            <LogOut className="size-4" /> Check-out
          </Button>
        ) : st === "checkout" ? (
          <Button
            size="lg"
            className="w-full bg-success text-success-foreground hover:bg-success/90"
            onClick={onCheckin}
            disabled={ocupado}
          >
            <RotateCcw className="size-4" /> Nova entrada
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full bg-success text-success-foreground hover:bg-success/90"
            onClick={onCheckin}
            disabled={ocupado}
          >
            <CheckCircle2 className="size-4" /> Check-in
          </Button>
        )}
      </div>
    </Card>
  );
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro na requisição");
  return (body as { data: T }).data;
}

async function buscarInscricaoDetalhe(id: string): Promise<InscricaoDetalhe | null> {
  const res = await fetch(`/api/inscricoes/${id}`);
  if (res.status === 404) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao buscar inscrição");
  return (body as { data: InscricaoDetalhe }).data;
}

async function buscarTicketPorHash(hash: string): Promise<TicketDetalhe | null> {
  const res = await fetch(`/api/tickets?hash=${hash}`);
  if (res.status === 404) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao buscar ingresso");
  return (body as { data: TicketDetalhe }).data;
}

async function jaAceitouTermo(pessoaId: string, eventoId: string | null): Promise<boolean> {
  const qs = new URLSearchParams({ pessoa_id: pessoaId, tipo: "responsabilidade" });
  if (eventoId) qs.set("evento_id", eventoId);
  const data = await apiJson<{ id: string }[]>(`/api/termos?${qs.toString()}`);
  return data.length > 0;
}

export function CheckinView() {
  const [scannerAtivo, setScannerAtivo] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<InscricaoDetalhe[]>([]);
  const [selecionada, setSelecionada] = useState<InscricaoDetalhe | null>(null);
  const [ticketSelecionado, setTicketSelecionado] = useState<TicketDetalhe | null>(null);
  const [eventoFiltro, setEventoFiltro] = useState<string | null>(null);
  const [erroScanner, setErroScanner] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ScanFeedbackData | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [termoSheet, setTermoSheet] = useState<{
    open: boolean;
    inscricaoId: string;
    eventoId: string;
    pessoaId: string;
    pessoaNome: string;
  } | null>(null);

  const suporteScanner = isQrScanSupported();

  useEffect(() => {
    let ativo = true;
    apiJson<Evento[]>("/api/eventos")
      .then((data) => {
        if (ativo) setEventos(data);
      })
      .catch(() => {
        if (ativo) setEventos([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (selecionada || ticketSelecionado) setScannerAtivo(false);
  }, [selecionada, ticketSelecionado]);

  function emitir(kind: ScanFeedbackKind, title: string, subtitle?: string) {
    setFeedback({ kind, title, subtitle });
    playScanBeep(kind);
    vibrateScan(kind);
  }

  const recarregarSelecionada = useCallback(async (inscricaoId: string) => {
    try {
      const det = await buscarInscricaoDetalhe(inscricaoId);
      if (det) setSelecionada(det);
    } catch {
      // mantém o cartão atual se o recarregamento falhar
    }
  }, []);

  async function fazerCheckinInscricao(inscricaoId: string, pessoaNome: string) {
    setOcupado(true);
    try {
      await apiJson<Inscricao>(`/api/inscricoes/${inscricaoId}/checkin`, { method: "POST" });
      emitir("ok", "ENTRADA LIBERADA", pessoaNome || undefined);
      await recarregarSelecionada(inscricaoId);
    } catch {
      emitir("error", "FALHA NO CHECK-IN", "Tente novamente.");
    } finally {
      setOcupado(false);
    }
  }

  async function fazerCheckinComTermo(inscricao: Inscricao, pessoaNome: string) {
    try {
      const aceitou = await jaAceitouTermo(inscricao.pessoa_id, inscricao.evento_id);
      if (!aceitou) {
        setTermoSheet({
          open: true,
          inscricaoId: inscricao.id,
          eventoId: inscricao.evento_id,
          pessoaId: inscricao.pessoa_id,
          pessoaNome,
        });
        return;
      }
      await fazerCheckinInscricao(inscricao.id, pessoaNome);
    } catch (err) {
      toast.error("Não foi possível verificar o termo", {
        description: (err as Error).message,
      });
    }
  }

  async function fazerCheckoutInscricao(inscricaoId: string) {
    setOcupado(true);
    try {
      await apiJson<Inscricao>(`/api/inscricoes/${inscricaoId}/checkout`, { method: "POST" });
      toast.success("Check-out realizado");
      await recarregarSelecionada(inscricaoId);
    } catch (err) {
      toast.error("Falha ao registrar check-out", { description: (err as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  async function handleCheckinTicket(ticketId: string) {
    setOcupado(true);
    try {
      const ticket = await apiJson<TicketDetalhe["ticket"]>(`/api/tickets/${ticketId}/checkin`, {
        method: "POST",
      });
      const nome = ticketSelecionado?.pessoa?.nome_completo ?? undefined;
      setTicketSelecionado((prev) => (prev ? { ...prev, ticket } : prev));
      emitir("ok", "ENTRADA LIBERADA", nome);
    } catch {
      emitir("error", "FALHA NO CHECK-IN", "Tente novamente.");
    } finally {
      setOcupado(false);
    }
  }

  async function buscarPorNome(termo: string) {
    const qs = new URLSearchParams({ busca: termo });
    if (eventoFiltro) qs.set("evento", eventoFiltro);
    const res = await apiJson<InscricaoDetalhe[]>(`/api/inscricoes?${qs.toString()}`);
    if (res.length === 0) {
      toast.info("Nenhuma inscrição encontrada.");
    }
    setResultados(res);
  }

  async function resolverTexto(texto: string) {
    try {
      const hash = parseIngressoQr(texto);
      if (hash) {
        const det = await buscarTicketPorHash(hash);
        if (!det) {
          emitir("error", "NÃO ENCONTRADO", "Nenhum ingresso com este QR code.");
          return;
        }
        setTicketSelecionado(det);
        setSelecionada(null);
        setBusca("");
        setResultados([]);
        if (det.ticket.is_checked_in) {
          emitir("warn", "JÁ UTILIZADO", det.pessoa?.nome_completo ?? undefined);
        }
        return;
      }

      const id = parseInscricaoQr(texto);
      if (id) {
        const det = await buscarInscricaoDetalhe(id);
        if (!det) {
          emitir("error", "NÃO ENCONTRADO", "Inscrição não encontrada.");
          return;
        }
        setSelecionada(det);
        setTicketSelecionado(null);
        setBusca("");
        setResultados([]);
        if (det.inscricao.status === "checkin") {
          emitir("warn", "JÁ ESTÁ PRESENTE", det.pessoa?.nome_completo ?? undefined);
        }
        return;
      }

      await buscarPorNome(texto);
    } catch (err) {
      emitir("error", "FALHA NA BUSCA", (err as Error).message);
    }
  }

  async function handleScan(raw: string) {
    await resolverTexto(raw);
  }

  async function handleBuscaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await resolverTexto(busca);
  }

  async function selecionarDaLista(inscId: string) {
    try {
      const det = await buscarInscricaoDetalhe(inscId);
      if (det) {
        setSelecionada(det);
        setResultados([]);
        setBusca("");
      }
    } catch (err) {
      toast.error("Não foi possível abrir a inscrição", { description: (err as Error).message });
    }
  }

  return (
    <PageContainer width="content">
      <PageHeader
        title="Recepção"
        description="Check-in de inscrições e ingressos — registrado em tempo real."
      />

      <Card className="mb-4">
        <CardContent className="pt-6 grid gap-3">
          <div className="flex items-center gap-3">
            <Label htmlFor="evento_filtro" className="shrink-0 w-20">
              Evento
            </Label>
            <Select value={eventoFiltro ?? ""} onValueChange={(v) => setEventoFiltro(v || null)}>
              <SelectTrigger id="evento_filtro" className="w-full">
                <SelectValue placeholder="Todos os eventos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os eventos</SelectItem>
                {eventos?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!suporteScanner ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <AlertCircle className="size-4 inline text-amber-600" />
              <span className="ml-2">
                Leitor de QR não suportado neste navegador. Use a busca manual.
              </span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setScannerAtivo(!scannerAtivo)}
            >
              {scannerAtivo ? (
                <span className="flex items-center gap-2 justify-center">
                  <Circle className="size-4 animate-spin" /> Parar leitor
                </span>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  <ScanLine className="size-4" /> Abrir leitor de QR
                </span>
              )}
            </Button>
          )}

          <form onSubmit={handleBuscaSubmit} className="flex gap-2">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="QR de ingresso, QR/id da inscrição ou nome do participante"
              aria-label="Buscar inscrição ou ingresso"
              className="flex-1"
            />
            <Button type="submit">Buscar</Button>
          </form>

          {erroScanner && <p className="text-sm text-destructive">{erroScanner}</p>}
        </CardContent>
      </Card>

      {scannerAtivo && suporteScanner && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <QrScanner active onScan={handleScan} onError={setErroScanner} />
          </CardContent>
        </Card>
      )}

      {ticketSelecionado ? (
        <TicketActionCard
          det={ticketSelecionado}
          onClose={() => setTicketSelecionado(null)}
          onCheckin={handleCheckinTicket}
        />
      ) : selecionada ? (
        <ActionCard
          det={selecionada}
          ocupado={ocupado}
          onClose={() => setSelecionada(null)}
          onCheckin={() =>
            fazerCheckinComTermo(selecionada.inscricao, selecionada.pessoa?.nome_completo ?? "")
          }
          onCheckout={() => fazerCheckoutInscricao(selecionada.inscricao.id)}
        />
      ) : resultados.length > 0 ? (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Resultados da busca ({resultados.length})
            </h3>
            <ul className="space-y-1 max-h-60 overflow-auto">
              {resultados.map(({ inscricao, pessoa, evento }) => (
                <li key={inscricao.id}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left gap-2 p-2"
                    onClick={() => selecionarDaLista(inscricao.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{pessoa?.nome_completo ?? "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {evento?.nome ?? "—"}
                        {evento ? ` · ${formatDate(evento.data_inicio)}` : ""}
                      </p>
                    </div>
                    <StatusBadge tone={STATUS_TONE[inscricao.status] ?? "neutral"}>
                      {STATUS_LABEL[inscricao.status] ?? inscricao.status}
                    </StatusBadge>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon="search"
          title="Nenhuma leitura realizada"
          description="Escanere um QR ou use a busca manual abaixo."
        />
      )}

      <QRGeneratorLazy />
      {termoSheet && (
        <TermoAceiteSheet
          pessoaId={termoSheet.pessoaId}
          pessoaNome={termoSheet.pessoaNome}
          tipo="responsabilidade"
          eventoId={termoSheet.eventoId}
          open={termoSheet.open}
          onOpenChange={(open) => {
            if (!open) setTermoSheet(null);
            else setTermoSheet((s) => (s ? { ...s, open } : null));
          }}
          onSuccess={() => {
            void fazerCheckinInscricao(termoSheet.inscricaoId, termoSheet.pessoaNome);
            setTermoSheet(null);
          }}
        />
      )}

      <ScanFeedback feedback={feedback} onDone={() => setFeedback(null)} />
    </PageContainer>
  );
}
