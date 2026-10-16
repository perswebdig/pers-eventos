"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { EstabelecimentoForm } from "./estabelecimento-form";
import {
  toEstabelecimentoFormValues,
  type EstabelecimentoFormValues,
} from "./estabelecimento-schema";
import type { Estabelecimento } from "@/types/database";

// Cliente HTTP para as rotas do Super Admin.
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? "Erro na requisição");
  }
  return (body as { data: T }).data;
}

export function EstabelecimentosView() {
  const [itens, setItens] = useState<Estabelecimento[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Estabelecimento | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Estabelecimento | null>(null);

  const carregar = useCallback(async () => {
    try {
      setItens(await api<Estabelecimento[]>("/api/admin/estabelecimentos"));
    } catch (err) {
      toast.error("Falha ao carregar", { description: (err as Error).message });
      setItens([]);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleSubmit(values: EstabelecimentoFormValues) {
    try {
      if (editing) {
        await api(`/api/admin/estabelecimentos/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(values),
        });
        toast.success("Estabelecimento atualizado");
      } else {
        await api("/api/admin/estabelecimentos", {
          method: "POST",
          body: JSON.stringify(values),
        });
        toast.success("Estabelecimento criado");
      }
      setFormOpen(false);
      setEditing(null);
      await carregar();
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: (err as Error).message,
      });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api(`/api/admin/estabelecimentos/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success("Estabelecimento removido");
      setDeleteTarget(null);
      await carregar();
    } catch (err) {
      toast.error("Não foi possível remover", {
        description: (err as Error).message,
      });
    }
  }

  const emptyValues = useMemo(() => toEstabelecimentoFormValues({}), []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Estabelecimentos</h1>
          <p className="text-sm text-muted-foreground">
            {itens === null ? "Carregando…" : `${itens.length} estabelecimento(s)`}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" /> Novo
        </Button>
      </div>

      {itens === null ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ) : itens.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Nenhum estabelecimento cadastrado"
          description="Cadastre o primeiro tenant da plataforma."
          actions={
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" /> Criar estabelecimento
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Slug</TableHead>
                <TableHead className="hidden md:table-cell">Cidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Building2 className="size-4 text-muted-foreground" />
                      {e.nome}
                    </span>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    {e.slug}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {e.cidade ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        e.ativo
                          ? "border-success/30 text-success"
                          : "border-muted-foreground/30 text-muted-foreground"
                      }
                    >
                      {e.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${e.nome}`}
                        onClick={() => {
                          setEditing(e);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${e.nome}`}
                        onClick={() => setDeleteTarget(e)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar estabelecimento" : "Novo estabelecimento"}</DialogTitle>
            <DialogDescription>Dados do tenant (estabelecimento) da plataforma.</DialogDescription>
          </DialogHeader>
          <EstabelecimentoForm
            key={editing?.id ?? "novo"}
            defaultValues={editing ? toEstabelecimentoFormValues(editing) : emptyValues}
            onSubmit={handleSubmit}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir estabelecimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o estabelecimento e, por cascata, todos os eventos, pessoas e
              registros vinculados. Não pode ser desfeita.
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
