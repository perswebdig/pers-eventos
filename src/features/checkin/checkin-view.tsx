"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import dynamic from "next/dynamic";
import {
  ScanLine,
  Search,
  CheckCircle2,
  LogOut,
  RotateCcw,
  X,
  Circle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { EmptyState, LoadingSkeleton } from "@/components/empty-state";
import {
  listEventos,
  getInscricaoDetalhe,
  fazerCheckin,
  fazerCheckout,
  buscarInscricoes,
} from "@/db/repos/eventos";
import type { InscricaoDetalhe } from "@/db/repos/eventos";
import type { EventoLocal } from "@/db/types";
import { formatDate, formatDateTime } from "@/lib/format";
import { QrScanner, isQrScanSupported } from "./qr-scanner";
import { parseInscricaoQr, encodeInscricaoQr } from "./qr";
import { QRCodeSVG } from "qrcode.react";
import { TermoAceiteSheet } from "@/features/termos/termo-aceite-sheet";
import { jaAceitouTermo } from "@/db/repos/termos";

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

const STATUS_TONE: Record<string, string> = {
  inscrito: "border-blue-500/30 text-blue-600 dark:text-blue-400",
  confirmado: "border-green-500/30 text-green-600 dark:text-green-400",
  checkin: "border-green-600/30 text-green-700 dark:text-green-500",
  checkout: "border-muted-foreground/30 text-muted-foreground",
  cancelado: "border-destructive/30 text-destructive",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STATUS_TONE[status] ?? ""}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function ActionCard({
  det,
  onClose,
  onCheckin,
}: {
  det: InscricaoDetalhe | null;
  onClose: () => void;
  onCheckin: (inscricaoId: string, eventoId: string, pessoaId: string, pessoaNome: string) => void;
}) {
  if (!det) return null;
  const { inscricao, pessoa, evento } = det;
  const st = inscricao.status;

  return (
    <Card className="relative overflow-hidden border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
        onClick={onClose}
      >
        <X className="size-4" />
      </Button>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{pessoa?.nome_completo ?? "—"}</h3>
          <StatusBadge status={st} />
        </div>
        {pessoa?.cpf && <p className="text-sm text-muted-foreground">CPF: {pessoa.cpf}</p>}
        <p className="text-sm text-muted-foreground">
          {evento?.nome ?? "Evento não encontrado"}
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-2 border-t">
          <div>
            <span className="font-medium">Check-in:</span>{" "}
            {formatDateTime(inscricao.data_checkin)}
          </div>
          <div>
            <span className="font-medium">Check-out:</span>{" "}
            {formatDateTime(inscricao.data_checkout)}
          </div>
        </div>
        <Separator />
        {st === "checkin" ? (
          <Button
            className="w-full"
            onClick={async () => {
              const r = await fazerCheckout(inscricao.id);
              if (r) {
                toast.success("Check-out realizado");
              } else {
                toast.error("Falha ao registrar check-out");
              }
            }}
          >
            <LogOut className="size-4" /> Check-out
          </Button>
        ) : st === "checkout" ? (
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={() => onCheckin(inscricao.id, inscricao.evento_id, inscricao.pessoa_id, pessoa?.nome_completo ?? "")}
          >
            <RotateCcw className="size-4" /> Nova entrada
          </Button>
        ) : (
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={() => onCheckin(inscricao.id, inscricao.evento_id, inscricao.pessoa_id, pessoa?.nome_completo ?? "")}
          >
            <CheckCircle2 className="size-4" /> Check-in
          </Button>
        )}
      </div>
    </Card>
  );
}

export function CheckinView() {
  const [scannerAtivo, setScannerAtivo] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<InscricaoDetalhe[]>([]);
  const [selecionada, setSelecionada] = useState<InscricaoDetalhe | null>(null);
  const [eventoFiltro, setEventoFiltro] = useState<string | null>(null);
  const [erroScanner, setErroScanner] = useState<string | null>(null);
  const [termoSheet, setTermoSheet] = useState<{
    open: boolean;
    inscricaoId: string;
    eventoId: string;
    pessoaId: string;
    pessoaNome: string;
  } | null>(null);

  const eventos = useLiveQuery(() => listEventos(), []);
  const suporteScanner = isQrScanSupported();

  useEffect(() => {
    if (selecionada) setScannerAtivo(false);
  }, [selecionada]);

  async function fazerCheckinComTermo(
    inscricaoId: string,
    eventoId: string,
    pessoaId: string,
    pessoaNome: string,
  ) {
    // Verifica se já aceitou o termo de responsabilidade para este evento
    const aceitou = await jaAceitouTermo(pessoaId, "responsabilidade", eventoId);
    if (!aceitou) {
      setTermoSheet({ open: true, inscricaoId, eventoId, pessoaId, pessoaNome });
      return;
    }
    const r = await fazerCheckin(inscricaoId);
    if (r) toast.success("Check-in realizado");
    else toast.error("Falha ao registrar check-in");
  }

  useEffect(() => {
    if (selecionada) setScannerAtivo(false);
  }, [selecionada]);

  async function resolverTexto(texto: string) {
    const id = parseInscricaoQr(texto);
    if (id) {
      const det = await getInscricaoDetalhe(id);
      if (!det) {
        toast.error("Inscrição não encontrada neste dispositivo (ainda não sincronizada?).");
        return;
      }
      setSelecionada(det);
      setBusca("");
      setResultados([]);
      return;
    }
    // busca por nome
    const res = await buscarInscricoes(texto, eventoFiltro || undefined);
    if (res.length === 0) {
      toast.info("Nenhuma inscrição encontrada.");
    }
    setResultados(res);
  }

  async function handleScan(raw: string) {
    await resolverTexto(raw);
  }

  async function handleBuscaSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await resolverTexto(busca);
  }

  async function selecionarDaLista(inscId: string) {
    const det = await getInscricaoDetalhe(inscId);
    if (det) {
      setSelecionada(det);
      setResultados([]);
      setBusca("");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Recepção</h1>

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
              className="w-full"
              onClick={() => setScannerAtivo(!scannerAtivo)}
            >
              {scannerAtivo
                ? <span className="flex items-center gap-2 justify-center"><Circle className="size-4 animate-spin" /> Parar leitor</span>
                : <span className="flex items-center gap-2 justify-center"><ScanLine className="size-4" /> Abrir leitor de QR</span>}
            </Button>
          )}

          <form onSubmit={handleBuscaSubmit} className="flex gap-2">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Código QR, ID da inscrição ou nome do participante"
              aria-label="Buscar inscrição"
              className="flex-1"
            />
            <Button type="submit">Buscar</Button>
          </form>

          {erroScanner && (
            <p className="text-sm text-destructive">{erroScanner}</p>
          )}
        </CardContent>
      </Card>

      {scannerAtivo && suporteScanner && (
        <Card className="mb-4">
          <CardContent className="pt-6">
            <QrScanner active onScan={handleScan} onError={setErroScanner} />
          </CardContent>
        </Card>
      )}

      {selecionada ? (
        <ActionCard
          det={selecionada}
          onClose={() => setSelecionada(null)}
          onCheckin={fazerCheckinComTermo}
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
                      </p>
                    </div>
                    <StatusBadge status={inscricao.status} />
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
            fazerCheckin(termoSheet.inscricaoId).then((r) => {
              if (r) toast.success("Check-in realizado");
              else toast.error("Falha ao registrar check-in");
            });
            setTermoSheet(null);
          }}
        />
      )}
    </div>
  );
}

function QRGenerator() {
  const [qrInscId, setQrInscId] = useState("");

  return (
    <Card>
      <CardContent className="pt-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Gerar QR de uma inscrição
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Informe o ID da inscrição para visualizar/baixar o QR code.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Cole o UUID da inscrição"
            onChange={(e) => {
              const id = e.target.value.trim();
              if (id && parseInscricaoQr(`PERS1:${id}`)) {
                setQrInscId(id);
              }
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              // estado já atualizado via onChange
            }}
          >
            Gerar
          </Button>
        </div>
        {qrInscId && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="bg-white p-4 rounded-lg shadow">
              <QRCodeSVG value={encodeInscricaoQr(qrInscId)} size={180} />
            </div>
            <p className="text-xs text-muted-foreground font-mono">{encodeInscricaoQr(qrInscId)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}