"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Link2, Loader2, Plus, RefreshCw, UserPlus } from "lucide-react";
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
import { Toolbar, ToolbarSearch } from "@/components/toolbar";
import { EmptyState, LoadingSkeleton } from "@/components/empty-state";
import { PessoaForm } from "./pessoa-form";
import { toPessoaFormValues, type PessoaFormValues } from "./pessoa-schema";
import { filtrarPessoas } from "./busca";
import { interpretarBusca } from "./vincular-schema";
import type { Menor, Pessoa } from "@/types/database";
import { formatCpf, formatTelefone } from "@/lib/format";

const PessoaDetailSheetLazy = dynamic(
  () => import("./pessoa-detail").then((m) => m.PessoaDetailSheet),
  {
    loading: () => <div className="animate-pulse h-64 w-full" />,
    ssr: false,
  },
);

function PessoaIdentidade({ pessoa }: { pessoa: Pessoa }) {
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
  const [atualizando, setAtualizando] = useState(false);
  const [vincularOpen, setVincularOpen] = useState(false);
  const [buscaVinculo, setBuscaVinculo] = useState("");
  const [vinculando, setVinculando] = useState(false);

  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/pessoas");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao carregar");
      setPessoas((body as { data: Pessoa[] }).data ?? []);
    } catch (err) {
      setPessoas([]);
      toast.error("Não foi possível carregar as pessoas", {
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

  const filtradas = useMemo(
    () => (pessoas ? filtrarPessoas(pessoas, termo) : null),
    [pessoas, termo],
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
    fetch(`/api/pessoas/${editingId}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro");
        return body as { data: { pessoa: Pessoa; menor: Menor | null } };
      })
      .then(({ data }) => {
        if (!ativo || !data?.pessoa) return;
        setFormValues(
          toPessoaFormValues({
            ...data.pessoa,
            responsavel_nome: data.menor?.responsavel_nome ?? "",
            responsavel_cpf: data.menor?.responsavel_cpf ?? "",
          } as Partial<Pessoa>),
        );
      })
      .catch((err: Error) => {
        if (!ativo) return;
        toast.error("Não foi possível carregar a pessoa", { description: err.message });
        setFormOpen(false);
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
    try {
      const res = await fetch(editingId ? `/api/pessoas/${editingId}` : "/api/pessoas", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao salvar");

      const id = (body as { data?: { id?: string } }).data?.id ?? editingId;
      toast.success(editingId ? "Pessoa atualizada" : "Pessoa cadastrada");
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
      const res = await fetch(`/api/pessoas/${deleteId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao excluir");
      toast.success("Pessoa excluída");
      setDeleteId(null);
      setDetailOpen(false);
      setDetailId(null);
      await carregar();
    } catch (err) {
      toast.error("Não foi possível excluir", { description: (err as Error).message });
    }
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

  const carregando = pessoas === null;
  const lista = filtradas ?? [];
  const vazioSemBusca = !carregando && lista.length === 0 && !termo;

  const columns: DataTableColumn<Pessoa>[] = [
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
      key: "email",
      header: "E-mail",
      cell: (pessoa) =>
        pessoa.email ? (
          <span className="truncate">{pessoa.email}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Pessoas"
        description={carregando ? "Carregando…" : `${lista.length} registro(s)`}
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
          description="Cadastre a primeira pessoa ou vincule alguém que já usa a plataforma."
          actions={
            <Button onClick={abrirCriacao}>
              <UserPlus className="size-4" /> Cadastrar
            </Button>
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
              Os dados são salvos no estabelecimento e ficam disponíveis para toda a equipe.
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
        description="Esta ação remove a pessoa e seus dados relacionados. Não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        onConfirm={handleDelete}
      />
    </PageContainer>
  );
}
