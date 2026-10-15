"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import dynamic from "next/dynamic";
import { CalendarDays, Database, MapPin, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EventoForm } from "./evento-form";
import { EmptyState, LoadingSkeleton } from "@/components/empty-state";
import {
  eventoStatusLabel,
  toEventoFormValues,
  type EventoFormValues,
} from "./evento-schema";
import {
  deleteEvento,
  filtrarEventos,
  getEvento,
  inscricoesPorEvento,
  listEventos,
  saveEvento,
} from "@/db/repos/eventos";
import { seedLocalDatabase } from "@/db/seed";
import { formatDate } from "@/lib/format";

const STATUS_TONE: Record<string, string> = {
  planejado: "border-blue-600/30 text-blue-700 dark:text-blue-400",
  aberto: "border-green-600/30 text-green-700 dark:text-green-500",
  lotado: "border-amber-600/30 text-amber-700 dark:text-amber-500",
  realizado: "border-muted-foreground/30 text-muted-foreground",
  cancelado: "border-destructive/30 text-destructive",
};

const EventoDetailSheetLazy = dynamic(() => import("./evento-detail").then((m) => m.EventoDetailSheet), {
  loading: () => <div className="animate-pulse h-64 w-full" />,
  ssr: false,
});

export function EventosView() {
  const [termo, setTermo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<EventoFormValues | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const eventos = useLiveQuery(() => listEventos(), []);
  const counts = useLiveQuery(() => inscricoesPorEvento(), []);
  const filtrados = useMemo(
    () => (eventos ? filtrarEventos(eventos, termo) : eventos),
    [eventos, termo],
  );

  const emptyValues = useMemo(() => toEventoFormValues({}), []);

  useEffect(() => {
    if (!formOpen) return;
    if (!editingId) {
      setFormValues(emptyValues);
      return;
    }
    let ativo = true;
    setFormValues(null);
    void getEvento(editingId).then((ev) => {
      if (!ativo || !ev) return;
      setFormValues(toEventoFormValues(ev));
    });
    return () => {
      ativo = false;
    };
  }, [formOpen, editingId, emptyValues]);

  function abrirCriacao() {
    setEditingId(null);
    setFormOpen(true);
  }

  function abrirEdicao(id: string) {
    setEditingId(id);
    setDetailOpen(false);
    setFormOpen(true);
  }

  async function handleSubmit(values: EventoFormValues) {
    const id = await saveEvento(values, editingId ?? undefined);
    toast.success(editingId ? "Evento atualizado" : "Evento criado", {
      description: "Salvo localmente — será sincronizado.",
    });
    setFormOpen(false);
    setEditingId(null);
    setDetailId(id);
    setDetailOpen(true);
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deleteEvento(deleteId);
    toast.success("Evento excluído");
    setDeleteId(null);
    setDetailOpen(false);
    setDetailId(null);
  }

  async function handleSeed() {
    const n = await seedLocalDatabase();
    toast.success(n ? "Dados de exemplo adicionados" : "Já existem dados de exemplo");
  }

  const carregando = eventos === undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Eventos</h1>
          <p className="text-sm text-muted-foreground">
            {carregando ? "Carregando…" : `${filtrados?.length ?? 0} evento(s)`}
          </p>
        </div>
        <Button onClick={abrirCriacao}>
          <Plus className="size-4" /> Novo
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por nome, local ou status"
          className="pl-8"
          aria-label="Buscar eventos"
        />
      </div>

      {carregando ? (
        <LoadingSkeleton count={2} />
      ) : filtrados && filtrados.length > 0 ? (
        <ul className="space-y-2">
          {filtrados.map((e) => {
            const total = counts?.get(e.id) ?? 0;
            const cheio = e.capacidade !== null && total >= e.capacidade;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDetailId(e.id);
                    setDetailOpen(true);
                  }}
                  className="w-full rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{e.nome}</p>
                    <Badge
                      variant="outline"
                      className={STATUS_TONE[e.status] ?? ""}
                    >
                      {eventoStatusLabel(e.status)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {formatDate(e.data_inicio)}
                      {e.data_fim ? ` – ${formatDate(e.data_fim)}` : ""}
                    </span>
                    {e.local ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {e.local}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      {total}
                      {e.capacidade !== null ? `/${e.capacidade}` : ""}
                      {cheio ? " · lotado" : ""}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={termo ? "search" : "calendar"}
          title={termo ? "Nenhum resultado" : "Nenhum evento cadastrado"}
          description={
            termo
              ? "Tente outro nome, local ou status."
              : "Crie o primeiro evento ou carregue dados de exemplo."
          }
          actions={
            !termo ? (
              <>
                <Button onClick={abrirCriacao}>
                  <Plus className="size-4" /> Criar evento
                </Button>
                <Button variant="outline" onClick={handleSeed}>
                  <Database className="size-4" /> Dados de exemplo
                </Button>
              </>
            ) : null
          }
        />
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
              Os dados são salvos no dispositivo e sincronizados automaticamente.
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

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o evento, suas inscrições e termos relacionados neste
              dispositivo e, quando houver conexão, no servidor. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
