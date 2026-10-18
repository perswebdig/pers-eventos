"use client";

import { useCallback, useEffect, useState } from "react";
import { Pause, Pencil, Play, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatCurrency } from "@/lib/format";
import { loteFormSchema } from "./lote-schema";
import type { TicketType } from "@/types/database";

interface FormState {
  id: string | null;
  name: string;
  price: string;
  quantity_total: string;
}

const FORM_VAZIO: FormState = { id: null, name: "", price: "", quantity_total: "" };

function loteDisponivel(lote: TicketType): number {
  return Math.max(0, lote.quantity_total - lote.quantity_sold);
}

// Seção "Lotes de ingressos" do detalhe do evento (Admin do Estabelecimento).
export function LotesSection({ eventoId }: { eventoId: string }) {
  const [lotes, setLotes] = useState<TicketType[] | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [removerId, setRemoverId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenant/ticket-types?event_id=${eventoId}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao carregar");
      setLotes((body as { data: TicketType[] }).data ?? []);
    } catch (err) {
      setLotes([]);
      toast.error("Não foi possível carregar os lotes", { description: (err as Error).message });
    }
  }, [eventoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleSalvar() {
    if (!form) return;
    const parsed = loteFormSchema.safeParse({
      name: form.name,
      price: form.price,
      quantity_total: form.quantity_total,
      is_active: true,
    });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErros(
        Object.fromEntries(
          Object.entries(flat).map(([campo, msgs]) => [campo, msgs?.[0] ?? "Valor inválido."]),
        ),
      );
      return;
    }

    const existente = form.id ? lotes?.find((l) => l.id === form.id) : undefined;
    setSalvando(true);
    try {
      const res = await fetch(
        form.id ? `/api/tenant/ticket-types/${form.id}` : "/api/tenant/ticket-types",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(form.id ? {} : { event_id: eventoId }),
            name: parsed.data.name,
            price: parsed.data.price,
            quantity_total: parsed.data.quantity_total,
            is_active: existente?.is_active ?? true,
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao salvar");

      toast.success(form.id ? "Lote atualizado" : "Lote criado");
      setForm(null);
      setErros({});
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o lote");
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggle(id: string, ativo: boolean) {
    try {
      const res = await fetch(`/api/tenant/ticket-types/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: ativo }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao atualizar");
      toast.success(ativo ? "Lote reativado" : "Lote pausado");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o lote");
    }
  }

  async function handleRemove() {
    if (!removerId) return;
    try {
      const res = await fetch(`/api/tenant/ticket-types/${removerId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao excluir");
      toast.success("Lote excluído");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir o lote");
    } finally {
      setRemoverId(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Ticket className="size-3.5" /> Lotes de ingressos
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setForm(FORM_VAZIO);
            setErros({});
          }}
        >
          <Plus className="size-3.5" /> Novo lote
        </Button>
      </div>

      {form ? (
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {form.id ? "Editar lote" : "Novo lote"}
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="lote_nome">Nome</Label>
            <Input
              id="lote_nome"
              placeholder="Ex.: 1º Lote"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {erros.name ? <p className="text-xs text-destructive">{erros.name}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="lote_preco">Preço (R$)</Label>
              <Input
                id="lote_preco"
                inputMode="decimal"
                placeholder="0,00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              {erros.price ? <p className="text-xs text-destructive">{erros.price}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lote_qtd">Quantidade</Label>
              <Input
                id="lote_qtd"
                inputMode="numeric"
                placeholder="100"
                value={form.quantity_total}
                onChange={(e) => setForm({ ...form, quantity_total: e.target.value })}
              />
              {erros.quantity_total ? (
                <p className="text-xs text-destructive">{erros.quantity_total}</p>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSalvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar lote"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setForm(null)} disabled={salvando}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {lotes === null ? (
        <p className="text-sm text-muted-foreground">Carregando lotes…</p>
      ) : lotes.length === 0 && !form ? (
        <p className="text-sm text-muted-foreground">
          Nenhum lote cadastrado. Crie um lote para começar a vender ingressos.
        </p>
      ) : (
        <ul className="space-y-2">
          {lotes.map((lote) => (
            <li key={lote.id} className="rounded-lg border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{lote.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(Number(lote.price))} · {lote.quantity_sold}/
                    {lote.quantity_total} vendido(s) · {loteDisponivel(lote)} disponível(is)
                  </p>
                </div>
                <Badge variant={lote.is_active ? "secondary" : "outline"}>
                  {lote.is_active ? "Ativo" : "Pausado"}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={lote.is_active ? "Pausar lote" : "Reativar lote"}
                  onClick={() => handleToggle(lote.id, !lote.is_active)}
                >
                  {lote.is_active ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4 text-success" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Editar lote"
                  onClick={() => {
                    setForm({
                      id: lote.id,
                      name: lote.name,
                      price: String(Number(lote.price)).replace(".", ","),
                      quantity_total: String(lote.quantity_total),
                    });
                    setErros({});
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir lote"
                  onClick={() => setRemoverId(lote.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={!!removerId}
        onOpenChange={(o) => {
          if (!o) setRemoverId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lote?</AlertDialogTitle>
            <AlertDialogDescription>
              O lote será removido deste evento. Lotes com ingressos vendidos não podem ser
              excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
