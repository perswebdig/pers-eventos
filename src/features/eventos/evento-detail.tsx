"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, MapPin, Pencil, Plus, Trash2, Square } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { encodeInscricaoQr } from "@/features/checkin/qr";
import { LotesSection } from "@/features/ingressos/lotes-section";
import { EspacosSection } from "./espacos-section";
import { formatCurrency, formatDate } from "@/lib/format";
import { INSCRICAO_STATUS, PAGAMENTO_STATUS, inscricaoStatusLabel } from "./evento-schema";
import type { Evento, Inscricao, Pessoa } from "@/types/database";

interface EventoDetalhe {
  evento: Evento;
  inscritos: Array<{ inscricao: Inscricao; pessoa: Pessoa | null }>;
  disponiveis: Pessoa[];
  vendas: { ingressosVendidos: number; receita: number };
}

const EVENTO_STATUS_TONE: Record<string, StatusTone> = {
  planejado: "info",
  aberto: "success",
  lotado: "warning",
  realizado: "neutral",
  cancelado: "danger",
};

const EVENTO_STATUS_LABEL: Record<string, string> = {
  planejado: "Planejado",
  aberto: "Aberto",
  lotado: "Lotado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

const PAGAMENTO_STATUS_LABEL: Record<string, string> = {
  pendente: "Pagamento pendente",
  pago: "Pago",
  isento: "Isento",
  estornado: "Estornado",
};

const INSCRICAO_STATUS_TONE: Record<string, StatusTone> = {
  inscrito: "info",
  confirmado: "primary",
  checkin: "success",
  checkout: "neutral",
  cancelado: "danger",
};

export function EventoDetailSheet({
  eventoId,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  eventoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [detalhe, setDetalhe] = useState<EventoDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novaPessoa, setNovaPessoa] = useState("");
  const [novoStatus, setNovoStatus] = useState("inscrito");
  const [novoPagamento, setNovoPagamento] = useState("pendente");
  const [novoValor, setNovoValor] = useState("");
  const [removerId, setRemoverId] = useState<string | null>(null);
  const [qrInscId, setQrInscId] = useState<string | null>(null);
  const [tab, setTab] = useState("inscritos");

  const carregar = useCallback(async () => {
    if (!eventoId) return;
    try {
      const res = await fetch(`/api/eventos/${eventoId}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao carregar");
      setDetalhe((body as { data: EventoDetalhe }).data);
      setErro(null);
    } catch (err) {
      setErro((err as Error).message);
    }
  }, [eventoId]);

  useEffect(() => {
    if (!open || !eventoId) {
      setDetalhe(null);
      setErro(null);
      return;
    }
    setDetalhe(null);
    void carregar();
  }, [open, eventoId, carregar]);

  async function handleAdd() {
    if (!eventoId || !novaPessoa) {
      toast.error("Selecione uma pessoa para inscrever.");
      return;
    }
    try {
      const res = await fetch(`/api/eventos/${eventoId}/inscricoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pessoa_id: novaPessoa,
          status: novoStatus,
          pagamento_status: novoPagamento,
          valor: novoValor,
          forma_pagamento: "",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error((body as { error?: string }).error ?? "Não foi possível inscrever");

      toast.success("Inscrição adicionada");
      setNovaPessoa("");
      setNovoValor("");
      setNovoStatus("inscrito");
      setNovoPagamento("pendente");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível inscrever");
    }
  }

  async function handleStatusChange(inscricaoId: string, status: string) {
    try {
      const res = await fetch(`/api/inscricoes/${inscricaoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao atualizar");
      toast.success("Inscrição atualizada");
      await carregar();
    } catch (err) {
      toast.error("Não foi possível atualizar", { description: (err as Error).message });
    }
  }

  async function handleRemove() {
    if (!removerId) return;
    try {
      const res = await fetch(`/api/inscricoes/${removerId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao remover");
      toast.success("Inscrição removida");
      setRemoverId(null);
      await carregar();
    } catch (err) {
      toast.error("Não foi possível remover", { description: (err as Error).message });
    }
  }

  const capacidade = detalhe?.evento.capacidade ?? null;
  const total = detalhe?.inscritos.length ?? 0;
  const cheio = capacidade !== null && total >= capacidade;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {erro ? (
          <div className="space-y-2 p-4">
            <p className="text-sm font-medium">Não foi possível carregar</p>
            <p className="text-sm text-muted-foreground">{erro}</p>
          </div>
        ) : !detalhe ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="truncate">{detalhe.evento.nome}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={EVENTO_STATUS_TONE[detalhe.evento.status] ?? "neutral"}>
                  {EVENTO_STATUS_LABEL[detalhe.evento.status] ?? detalhe.evento.status}
                </StatusBadge>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {formatDate(detalhe.evento.data_inicio)}
                  {detalhe.evento.data_fim ? ` – ${formatDate(detalhe.evento.data_fim)}` : ""}
                </span>
                {detalhe.evento.local ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {detalhe.evento.local}
                  </span>
                ) : null}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-3 px-4">
              {detalhe.evento.descricao ? (
                <p className="text-sm text-muted-foreground">{detalhe.evento.descricao}</p>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-muted/30 p-2.5">
                  <p className="text-xs text-muted-foreground">Inscritos</p>
                  <p className="font-semibold">
                    {total}
                    {capacidade !== null ? ` / ${capacidade}` : ""}
                  </p>
                  {cheio ? <p className="text-xs font-medium text-warning">Lotado</p> : null}
                </div>
                <div className="rounded-lg border bg-muted/30 p-2.5">
                  <p className="text-xs text-muted-foreground">Ingressos vendidos</p>
                  <p className="font-semibold">{detalhe.vendas.ingressosVendidos}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(detalhe.vendas.receita)}
                  </p>
                </div>
              </div>

              <Tabs value={tab} onValueChange={setTab} className="gap-3">
                <TabsList className="w-full">
                  <TabsTrigger value="inscritos" className="flex-1">
                    Inscritos
                  </TabsTrigger>
                  <TabsTrigger value="ingressos" className="flex-1">
                    Ingressos
                  </TabsTrigger>
                  <TabsTrigger value="espacos" className="flex-1">
                    Espaços
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="inscritos" className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Inscritos
                  </h3>
                  {detalhe.inscritos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma inscrição ainda.</p>
                  ) : (
                    <ul className="space-y-2">
                      {detalhe.inscritos.map(({ inscricao, pessoa }) => (
                        <li key={inscricao.id} className="rounded-lg border p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {pessoa?.nome_completo ?? "Pessoa removida"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {inscricao.valor !== null
                                  ? formatCurrency(inscricao.valor)
                                  : "Sem valor"}{" "}
                                ·{" "}
                                {PAGAMENTO_STATUS_LABEL[inscricao.pagamento_status] ??
                                  inscricao.pagamento_status}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Ver QR code da inscrição"
                              onClick={() => setQrInscId(inscricao.id)}
                            >
                              <Square className="size-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Remover inscrição"
                              onClick={() => setRemoverId(inscricao.id)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Select
                              value={inscricao.status}
                              onValueChange={(v) => {
                                if (v) void handleStatusChange(inscricao.id, v);
                              }}
                            >
                              <SelectTrigger size="sm" className="flex-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {INSCRICAO_STATUS.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <StatusBadge
                              tone={INSCRICAO_STATUS_TONE[inscricao.status] ?? "neutral"}
                            >
                              {inscricaoStatusLabel(inscricao.status)}
                            </StatusBadge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Separator />

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Nova inscrição
                    </h3>
                    {detalhe.disponiveis.length > 0 ? (
                      <div className="grid gap-3">
                        <div className="grid gap-1.5">
                          <Label htmlFor="nova_pessoa">Pessoa</Label>
                          <Select
                            value={novaPessoa}
                            onValueChange={(v) => setNovaPessoa(v as string)}
                          >
                            <SelectTrigger id="nova_pessoa" className="w-full">
                              <SelectValue placeholder="Selecione…" />
                            </SelectTrigger>
                            <SelectContent>
                              {detalhe.disponiveis.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.nome_completo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-1.5">
                            <Label htmlFor="novo_status">Status</Label>
                            <Select
                              value={novoStatus}
                              onValueChange={(v) => setNovoStatus(v as string)}
                            >
                              <SelectTrigger id="novo_status" className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {INSCRICAO_STATUS.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor="novo_pagamento">Pagamento</Label>
                            <Select
                              value={novoPagamento}
                              onValueChange={(v) => setNovoPagamento(v as string)}
                            >
                              <SelectTrigger id="novo_pagamento" className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PAGAMENTO_STATUS.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-1.5">
                          <Label htmlFor="novo_valor">Valor (R$)</Label>
                          <Input
                            id="novo_valor"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={novoValor}
                            onChange={(e) => setNovoValor(e.target.value)}
                          />
                        </div>
                        <Button type="button" onClick={handleAdd}>
                          <Plus className="size-4" /> Inscrever
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Todas as pessoas já estão inscritas — cadastre mais pessoas primeiro.
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="ingressos" className="space-y-3">
                  <LotesSection eventoId={detalhe.evento.id} />
                </TabsContent>

                <TabsContent value="espacos" className="space-y-3">
                  <EspacosSection eventoId={detalhe.evento.id} />
                </TabsContent>
              </Tabs>
            </div>

            <SheetFooter className="border-t">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onEdit(detalhe.evento.id)}
                >
                  <Pencil className="size-4" /> Editar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onDelete(detalhe.evento.id)}
                >
                  <Trash2 className="size-4" /> Excluir
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>

      <ConfirmDialog
        open={!!removerId}
        onOpenChange={(o) => {
          if (!o) setRemoverId(null);
        }}
        title="Remover inscrição?"
        description="A inscrição será removida deste evento (localmente e no servidor quando houver conexão)."
        confirmLabel="Remover"
        destructive
        onConfirm={handleRemove}
      />

      <Dialog open={!!qrInscId} onOpenChange={(o) => !o && setQrInscId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code da inscrição</DialogTitle>
            <DialogDescription>
              Escaneie na recepção para fazer check-in/check-out.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="bg-white p-4 rounded-lg shadow">
              <QRCodeSVG value={encodeInscricaoQr(qrInscId!)} size={200} />
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              {encodeInscricaoQr(qrInscId!)}
            </p>
            <Button variant="outline" onClick={() => setQrInscId(null)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
