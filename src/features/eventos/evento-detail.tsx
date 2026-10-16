"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarDays, MapPin, Pencil, Plus, Trash2, Users, Square } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  addInscricao,
  getEventoDetalhe,
  listPessoasDisponiveis,
  removeInscricao,
  updateInscricao,
} from "@/db/repos/eventos";
import { resumoVendas } from "@/db/repos/ingressos";
import { formatCurrency, formatDate } from "@/lib/format";
import { INSCRICAO_STATUS, PAGAMENTO_STATUS, inscricaoStatusLabel } from "./evento-schema";

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
  const detalhe = useLiveQuery(
    () => (eventoId ? getEventoDetalhe(eventoId) : Promise.resolve(null)),
    [eventoId],
  );
  const disponiveis = useLiveQuery(
    () => (eventoId ? listPessoasDisponiveis(eventoId) : Promise.resolve([])),
    [eventoId],
  );
  const vendas = useLiveQuery(
    () => (eventoId ? resumoVendas(eventoId) : Promise.resolve(null)),
    [eventoId],
  );

  const [novaPessoa, setNovaPessoa] = useState("");
  const [novoStatus, setNovoStatus] = useState("inscrito");
  const [novoPagamento, setNovoPagamento] = useState("pendente");
  const [novoValor, setNovoValor] = useState("");
  const [removerId, setRemoverId] = useState<string | null>(null);
  const [qrInscId, setQrInscId] = useState<string | null>(null);

  async function handleAdd() {
    if (!eventoId || !novaPessoa) {
      toast.error("Selecione uma pessoa para inscrever.");
      return;
    }
    try {
      await addInscricao(eventoId, {
        pessoa_id: novaPessoa,
        status: novoStatus as (typeof INSCRICAO_STATUS)[number]["value"],
        pagamento_status: novoPagamento as (typeof PAGAMENTO_STATUS)[number]["value"],
        valor: novoValor,
        forma_pagamento: "",
      });
      toast.success("Inscrição adicionada");
      setNovaPessoa("");
      setNovoValor("");
      setNovoStatus("inscrito");
      setNovoPagamento("pendente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível inscrever");
    }
  }

  async function handleRemove() {
    if (!removerId) return;
    await removeInscricao(removerId);
    toast.success("Inscrição removida");
    setRemoverId(null);
  }

  const capacidade = detalhe?.evento.capacidade ?? null;
  const total = detalhe?.totalInscritos ?? 0;
  const cheio = capacidade !== null && total >= capacidade;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {!detalhe ? (
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
                <Badge variant="secondary">{detalhe.evento.status}</Badge>
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

              <div className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-muted-foreground" />
                <span className="font-medium">
                  {total}
                  {capacidade !== null ? ` / ${capacidade}` : ""} inscrito(s)
                </span>
                {cheio ? <Badge variant="destructive">Lotado</Badge> : null}
              </div>

              {vendas && vendas.ingressosVendidos > 0 ? (
                <div className="rounded-lg border border-green-600/30 bg-green-500/5 p-2.5 text-sm">
                  <p className="font-medium text-green-700 dark:text-green-500">
                    {vendas.ingressosVendidos} ingresso(s) vendido(s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Receita: {formatCurrency(vendas.receita)} · {vendas.pedidosPagos} pedido(s) pago(s)
                  </p>
                </div>
              ) : null}

              <Separator />

              <LotesSection eventoId={detalhe.evento.id} />

              <Separator />

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
                              ? `R$ ${inscricao.valor.toFixed(2)}`
                              : "Sem valor"}{" "}
                            · {inscricao.pagamento_status}
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
                          onValueChange={(v) =>
                            updateInscricao(inscricao.id, {
                              status: v as (typeof INSCRICAO_STATUS)[number]["value"],
                            })
                          }
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
                        <Badge variant="outline">{inscricaoStatusLabel(inscricao.status)}</Badge>
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
                {disponiveis && disponiveis.length > 0 ? (
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="nova_pessoa">Pessoa</Label>
                      <Select value={novaPessoa} onValueChange={(v) => setNovaPessoa(v as string)}>
                        <SelectTrigger id="nova_pessoa" className="w-full">
                          <SelectValue placeholder="Selecione…" />
                        </SelectTrigger>
                        <SelectContent>
                          {disponiveis.map((p) => (
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
                    {disponiveis === undefined
                      ? "Carregando…"
                      : "Todas as pessoas já estão inscritas — cadastre mais pessoas primeiro."}
                  </p>
                )}
              </div>
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

      <AlertDialog
        open={!!removerId}
        onOpenChange={(o) => {
          if (!o) setRemoverId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover inscrição?</AlertDialogTitle>
            <AlertDialogDescription>
              A inscrição será removida deste evento (localmente e no servidor quando houver
              conexão).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
