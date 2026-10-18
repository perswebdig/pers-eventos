"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CalendarDays, MapPin, Plus, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Toolbar, ToolbarSearch } from "@/components/toolbar";
import { EventoForm } from "./evento-form";
import { EmptyState, LoadingSkeleton } from "@/components/empty-state";
import { eventoStatusLabel, toEventoFormValues, type EventoFormValues } from "./evento-schema";
import type { Evento } from "@/types/database";
import { formatDate } from "@/lib/format";
import { cn } from "cn";

const STATUS_TONE: Record<string, StatusTone> = {
  planejado: "info",
  aberto: "success",
  lotado: "warning",
  realizado: "neutral",
  cancelado: "danger",
};

type EventoComContagem = Evento & { inscricoes: { count: number }[] };

const EventoDetailSheetLazy = dynamic(
  () => import("./evento-detail").then((m) => m.EventoDetailSheet),
  {
    loading: () => <div className="animate-pulse h-64 w-full" />,
    ssr: false,
  },
);

function filtrarEventos(eventos: EventoComContagem[], termo: string): EventoComContagem[] {
  const t = termo.trim().toLowerCase();
  if (!t) return eventos;
  return eventos.filter(
    (e) =>
      e.nome.toLowerCase().includes(t) ||
      (e.local?.toLowerCase().includes(t) ?? false) ||
      e.status.toLowerCase().includes(t),
  );
}

export function EventosView() {
  const [termo, setTermo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<EventoFormValues | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const [eventos, setEventos] = useState<EventoComContagem[] | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/eventos");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao carregar");
      setEventos((body as { data: EventoComContagem[] }).data ?? []);
    } catch (err) {
      setEventos([]);
      toast.error("Não foi possível carregar os eventos", {
        description: (err as Error).message,
      });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function recarregar() {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }

  const filtrados = useMemo(
    () => (eventos ? filtrarEventos(eventos, termo) : null),
    [eventos, termo],
  );

  const emptyValues = useMemo(() => toEventoFormValues({}), []);

  useEffect(() => {
    if (!formOpen) return;
    if (!editingId) {
      setFormValues(emptyValues);
      return;
    }
    const ev = eventos?.find((e) => e.id === editingId);
    setFormValues(ev ? toEventoFormValues(ev) : emptyValues);
  }, [formOpen, editingId, eventos, emptyValues]);

  function abrirCriacao() {
    setEditingId(null);
    setFormOpen(true);
  }

  function abrirEdicao(id: string) {
    setEditingId(id);
    setDetailOpen(false);
    setFormOpen(true);
  }

  function abrirDetalhe(id: string) {
    setDetailId(id);
    setDetailOpen(true);
  }

  async function handleSubmit(values: EventoFormValues) {
    try {
      const res = await fetch(editingId ? `/api/eventos/${editingId}` : "/api/eventos", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao salvar");

      const id = (body as { data?: { id?: string } }).data?.id ?? editingId;
      toast.success(editingId ? "Evento atualizado" : "Evento criado");
      setFormOpen(false);
      setEditingId(null);
      await recarregar();
      if (id) {
        setDetailId(id);
        setDetailOpen(true);
      }
    } catch (err) {
      toast.error("Não foi possível salvar", { description: (err as Error).message });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/eventos/${deleteId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao excluir");
      toast.success("Evento excluído");
      setDeleteId(null);
      setDetailOpen(false);
      setDetailId(null);
      await carregar();
    } catch (err) {
      toast.error("Não foi possível excluir", { description: (err as Error).message });
    }
  }

  const carregando = eventos === null;
  const lista = filtrados ?? [];
  const vazioSemBusca = !carregando && lista.length === 0 && !termo;

  return (
    <PageContainer>
      <PageHeader
        title="Eventos"
        description={carregando ? "Carregando…" : `${lista.length} evento(s)`}
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={recarregar}
              disabled={atualizando}
              aria-label="Recarregar"
            >
              <RefreshCw className={`size-4 ${atualizando ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={abrirCriacao}>
              <Plus className="size-4" /> Novo
            </Button>
          </>
        }
      />

      <Toolbar className="mb-4">
        <ToolbarSearch
          value={termo}
          onValueChange={setTermo}
          placeholder="Buscar por nome, local ou status"
        />
      </Toolbar>

      {carregando ? (
        <LoadingSkeleton count={2} />
      ) : vazioSemBusca ? (
        <EmptyState
          icon="calendar"
          title="Nenhum evento cadastrado"
          description="Crie o primeiro evento do estabelecimento."
          actions={
            <Button onClick={abrirCriacao}>
              <Plus className="size-4" /> Criar evento
            </Button>
          }
        />
      ) : lista.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nenhum resultado"
          description="Tente outro nome, local ou status."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {lista.map((evento) => {
            const total = evento.inscricoes?.[0]?.count ?? 0;
            const cheio = evento.capacidade !== null && total >= evento.capacidade;
            const pct =
              evento.capacidade && evento.capacidade > 0
                ? Math.min(100, Math.round((total / evento.capacidade) * 100))
                : null;
            return (
              <li key={evento.id}>
                <Card
                  className="h-full cursor-pointer gap-3 p-4 transition-colors hover:ring-primary/30"
                  onClick={() => abrirDetalhe(evento.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") abrirDetalhe(evento.id);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{evento.nome}</p>
                    <StatusBadge tone={STATUS_TONE[evento.status] ?? "neutral"}>
                      {eventoStatusLabel(evento.status)}
                    </StatusBadge>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {formatDate(evento.data_inicio)}
                      {evento.data_fim ? ` – ${formatDate(evento.data_fim)}` : ""}
                    </span>
                    {evento.local ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {evento.local}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Users className="size-3.5" />
                        {total}
                        {evento.capacidade !== null ? `/${evento.capacidade}` : ""} inscrito(s)
                      </span>
                      {cheio ? (
                        <span className="font-medium text-warning">Lotado</span>
                      ) : pct !== null ? (
                        <span className="tabular-nums text-muted-foreground">{pct}%</span>
                      ) : null}
                    </div>
                    {pct !== null ? (
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            cheio ? "bg-warning" : "bg-primary",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar evento" : "Novo evento"}</DialogTitle>
            <DialogDescription>
              Os dados são salvos no estabelecimento e ficam disponíveis para toda a equipe.
            </DialogDescription>
          </DialogHeader>
          {formValues ? (
            <EventoForm
              key={editingId ?? "novo"}
              defaultValues={formValues}
              onSubmit={handleSubmit}
              onCancel={() => setFormOpen(false)}
            />
          ) : (
            <div className="space-y-3 py-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EventoDetailSheetLazy
        eventoId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={abrirEdicao}
        onDelete={(id: string) => setDeleteId(id)}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Excluir evento?"
        description="Esta ação remove o evento, suas inscrições e termos relacionados. Não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
      />
    </PageContainer>
  );
}
