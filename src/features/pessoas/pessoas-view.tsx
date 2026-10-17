"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import dynamic from "next/dynamic";
import { Database, Link2, Loader2, Plus, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Toolbar, ToolbarSearch } from "@/components/toolbar";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { EmptyState, LoadingSkeleton } from "@/components/empty-state";
import { PessoaForm } from "./pessoa-form";
import { toPessoaFormValues, type PessoaFormValues } from "./pessoa-schema";
import { interpretarBusca } from "./vincular-schema";
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

function PessoaIdentidade({ pessoa }: { pessoa: PessoaComSync }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-medium text-primary">
        {pessoa.nome_completo.slice(0, 1).toUpperCase()}
      </div>
      <span className="truncate font-medium">{pessoa.nome_completo}</span>
    </div>
  );
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
  const [vincularOpen, setVincularOpen] = useState(false);
  const [buscaVinculo, setBuscaVinculo] = useState("");
  const [vinculando, setVinculando] = useState(false);

  const pessoasLocal = useLiveQuery(() => listPessoas(), []);

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

  function abrirDetalhe(id: string) {
    setDetailId(id);
    setDetailOpen(true);
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

  async function handleVincular() {
    const alvo = interpretarBusca(buscaVinculo);
    if (!alvo) {
      toast.error("Busca inválida", {
        description: "Informe um CPF (11 dígitos) ou um e-mail válido.",
      });
      return;
    }

    setVinculando(true);
    try {
      const res = await fetch("/api/tenant/pessoas/vincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alvo),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao vincular");

      const pessoa = (body as { data?: { nome_completo?: string } }).data;
      toast.success(`Pessoa vinculada: ${pessoa?.nome_completo ?? "ok"}`, {
        description: "Ela já aparece na sua base de pessoas.",
      });
      setVincularOpen(false);
      setBuscaVinculo("");
      await recarregar();
    } catch (err) {
      toast.error("Não foi possível vincular", { description: (err as Error).message });
    } finally {
      setVinculando(false);
    }
  }

  const carregando = pessoasCombinadas === null && !usarLocal;
  const carregandoLocal = pessoasLocal === undefined;
  const lista = filtradas ?? [];
  const vazioSemBusca = !carregando && !carregandoLocal && lista.length === 0 && !termo;

  const columns: DataTableColumn<PessoaComSync>[] = [
    {
      key: "pessoa",
      header: "Pessoa",
      cell: (pessoa) => <PessoaIdentidade pessoa={pessoa} />,
    },
    {
      key: "cpf",
      header: "CPF",
      cell: (pessoa) =>
        pessoa.cpf ? (
          <span className="tabular-nums">{formatCpf(pessoa.cpf)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "telefone",
      header: "Telefone",
      cell: (pessoa) =>
        pessoa.telefone ? (
          <span className="tabular-nums">{formatTelefone(pessoa.telefone)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "sync",
      header: "Sync",
      align: "right",
      cell: (pessoa) => (
        <SyncStatusBadge status={pessoa.sync_status ?? "synced"} withLabel={false} />
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Pessoas"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {carregando || carregandoLocal ? "Carregando…" : `${lista.length} registro(s)`}
            {usarLocal ? <StatusBadge tone="warning">Offline</StatusBadge> : null}
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={recarregar}
              disabled={atualizando}
              aria-label="Recarregar do servidor"
            >
              <RefreshCw className={`size-4 ${atualizando ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" onClick={() => setVincularOpen(true)}>
              <Link2 className="size-4" /> Vincular
            </Button>
            <Button onClick={abrirCriacao}>
              <Plus className="size-4" /> Nova
            </Button>
          </>
        }
      />

      <Toolbar className="mb-4">
        <ToolbarSearch
          value={termo}
          onValueChange={setTermo}
          placeholder="Buscar por nome, CPF ou telefone"
        />
      </Toolbar>

      {carregando ? (
        <LoadingSkeleton count={3} />
      ) : vazioSemBusca ? (
        <EmptyState
          icon="users"
          title="Nenhuma pessoa cadastrada"
          description="Cadastre a primeira pessoa ou carregue dados de exemplo."
          actions={
            <>
              <Button onClick={abrirCriacao}>
                <UserPlus className="size-4" /> Cadastrar
              </Button>
              <Button variant="outline" onClick={handleSeed}>
                <Database className="size-4" /> Dados de exemplo
              </Button>
            </>
          }
        />
      ) : (
        <DataTable
          rows={lista}
          columns={columns}
          onRowClick={(pessoa) => abrirDetalhe(pessoa.id)}
          empty="Nenhum resultado para a busca."
          renderMobile={(pessoa) => (
            <div className="flex items-center gap-3 p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-medium text-primary">
                {pessoa.nome_completo.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{pessoa.nome_completo}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[
                    pessoa.cpf ? formatCpf(pessoa.cpf) : null,
                    pessoa.telefone ? formatTelefone(pessoa.telefone) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sem CPF/telefone"}
                </p>
              </div>
              <SyncStatusBadge status={pessoa.sync_status ?? "synced"} withLabel={false} />
            </div>
          )}
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

      <Dialog
        open={vincularOpen}
        onOpenChange={(open) => {
          setVincularOpen(open);
          if (!open) setBuscaVinculo("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular pessoa existente</DialogTitle>
            <DialogDescription>
              Adicione à sua base alguém que já usa a plataforma. Busque pelo CPF ou e-mail
              cadastrado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="vincular_busca">CPF ou e-mail</Label>
              <Input
                id="vincular_busca"
                placeholder="000.000.000-00 ou pessoa@exemplo.com"
                value={buscaVinculo}
                onChange={(e) => setBuscaVinculo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleVincular();
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setVincularOpen(false)} disabled={vinculando}>
                Cancelar
              </Button>
              <Button onClick={handleVincular} disabled={vinculando || !buscaVinculo.trim()}>
                {vinculando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Link2 className="size-4" />
                )}
                Vincular
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Excluir pessoa?"
        description="Esta ação remove a pessoa e seus dados relacionados neste dispositivo e, quando houver conexão, no servidor. Não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
      />
    </PageContainer>
  );
}
