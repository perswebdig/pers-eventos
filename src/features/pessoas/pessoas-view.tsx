"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import dynamic from "next/dynamic";
import { Database, Plus, Search, UserPlus, Users, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { EmptyState, LoadingSkeleton } from "@/components/empty-state";
import { PessoaForm } from "./pessoa-form";
import { toPessoaFormValues, type PessoaFormValues } from "./pessoa-schema";
import type { Pessoa } from "@/types/database";
import { LocalSyncFields } from "@/db/types";
import {
  deletePessoa,
  filtrarPessoas,
  getPessoaDetalhe,
  listPessoas,
  savePessoa,
} from "@/db/repos/pessoas";
import { seedLocalDatabase } from "@/db/seed";
import { formatCpf, formatTelefone } from "@/lib/format";

const PessoaDetailSheetLazy = dynamic(
  () => import("./pessoa-detail").then((m) => m.PessoaDetailSheet),
  {
    loading: () => <div className="animate-pulse h-64 w-full" />,
    ssr: false,
  },
);

type PessoaComSync = Pessoa & Partial<LocalSyncFields>;

async function fetchServerPessoas(): Promise<PessoaComSync[]> {
  try {
    const res = await fetch("/api/pessoas");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro");
    return (body as { data: Pessoa[] }).data ?? [];
  } catch {
    return [];
  }
}

export function PessoasView() {
  const [termo, setTermo] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<PessoaFormValues | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [usarLocal, setUsarLocal] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const pessoasLocal = useLiveQuery(() => listPessoas(), []);
  const pessoasServer = useMemo(() => (usarLocal ? [] : undefined), [usarLocal]);

  const [pessoasCombinadas, setPessoasCombinadas] = useState<PessoaComSync[] | null>(null);

  useEffect(() => {
    if (usarLocal) {
      setPessoasCombinadas(pessoasLocal ?? []);
      return;
    }

    let ativo = true;
    setPessoasCombinadas(null);
    fetchServerPessoas()
      .then((server) => {
        if (!ativo) return;
        if (server.length > 0) {
          setPessoasCombinadas(server);
        } else if (pessoasLocal !== undefined) {
          setPessoasCombinadas(pessoasLocal);
          setUsarLocal(true);
          toast.info("Modo offline — usando dados locais");
        } else {
          setPessoasCombinadas([]);
        }
      })
      .catch(() => {
        if (!ativo) return;
        if (pessoasLocal !== undefined) {
          setPessoasCombinadas(pessoasLocal);
          setUsarLocal(true);
          toast.info("Sem conexão — usando dados locais");
        } else {
          setPessoasCombinadas([]);
        }
      });
    return () => {
      ativo = false;
    };
  }, [pessoasLocal, usarLocal]);

  async function recarregar() {
    setAtualizando(true);
    setUsarLocal(false);
    setPessoasCombinadas(null);
    await new Promise((r) => setTimeout(r, 100));
    setAtualizando(false);
  }

  const filtradas = useMemo(
    () => (pessoasCombinadas ? filtrarPessoas(pessoasCombinadas, termo) : pessoasCombinadas),
    [pessoasCombinadas, termo],
  );

  const emptyValues = useMemo(() => toPessoaFormValues({}), []);

  useEffect(() => {
    if (!formOpen) return;
    if (!editingId) {
      setFormValues(emptyValues);
      return;
    }
    let ativo = true;
    setFormValues(null);
    void getPessoaDetalhe(editingId).then((det) => {
      if (!ativo || !det) return;
      setFormValues(
        toPessoaFormValues({
          ...det.pessoa,
          responsavel_nome: det.menor?.responsavel_nome ?? "",
          responsavel_cpf: det.menor?.responsavel_cpf ?? "",
        } as Partial<Pessoa>),
      );
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

  async function handleSubmit(values: PessoaFormValues) {
    const id = await savePessoa(values, editingId ?? undefined);
    toast.success(editingId ? "Pessoa atualizada" : "Pessoa cadastrada", {
      description: "Salvo localmente — será sincronizado.",
    });
    setFormOpen(false);
    setEditingId(null);
    setDetailId(id);
    setDetailOpen(true);
  }

  async function handleDelete() {
    if (!deleteId) return;
    await deletePessoa(deleteId);
    toast.success("Pessoa excluída");
    setDeleteId(null);
    setDetailOpen(false);
    setDetailId(null);
  }

  async function handleSeed() {
    const n = await seedLocalDatabase();
    toast.success(n ? `${n} pessoas de exemplo adicionadas` : "Já existem dados de exemplo");
  }

  const carregando = pessoasCombinadas === null && !usarLocal;
  const carregandoLocal = pessoasLocal === undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Pessoas</h1>
          <p className="text-sm text-muted-foreground">
            {carregando || carregandoLocal
              ? "Carregando…"
              : `${filtradas?.length ?? 0} registro(s)`}
            {usarLocal && (
              <span className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                Offline
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={recarregar}
            disabled={atualizando}
            aria-label="Recarregar do servidor"
          >
            <RefreshCw className={`size-4 ${atualizando ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={abrirCriacao}>
            <Plus className="size-4" /> Nova
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por nome, CPF ou telefone"
          className="pl-8"
          aria-label="Buscar pessoas"
        />
      </div>

      {carregando ? (
        <LoadingSkeleton count={3} />
      ) : filtradas && filtradas.length > 0 ? (
        <ul className="space-y-2">
          {filtradas.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setDetailId(p.id);
                  setDetailOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                  {p.nome_completo.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.nome_completo}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      p.cpf ? formatCpf(p.cpf) : null,
                      p.telefone ? formatTelefone(p.telefone) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sem CPF/telefone"}
                  </p>
                </div>
                <SyncStatusBadge status={p.sync_status ?? "synced"} withLabel={false} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={termo ? "search" : "users"}
          title={termo ? "Nenhum resultado" : "Nenhuma pessoa cadastrada"}
          description={
            termo
              ? "Tente outro nome, CPF ou telefone."
              : "Cadastre a primeira pessoa ou carregue dados de exemplo."
          }
          actions={
            !termo ? (
              <>
                <Button onClick={abrirCriacao}>
                  <UserPlus className="size-4" /> Cadastrar
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
            <DialogDescription>
              Os dados são salvos no dispositivo e sincronizados automaticamente.
            </DialogDescription>
          </DialogHeader>
          {formValues ? (
            <PessoaForm
              key={editingId ?? "nova"}
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

      <PessoaDetailSheetLazy
        pessoaId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={abrirEdicao}
        onDelete={(id) => setDeleteId(id)}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pessoa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a pessoa e seus dados relacionados neste dispositivo e, quando houver
              conexão, no servidor. Não pode ser desfeita.
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
