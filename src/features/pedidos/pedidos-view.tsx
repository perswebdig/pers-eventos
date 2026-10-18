"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toolbar, ToolbarSearch } from "@/components/toolbar";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { OrderStatus, PaymentMethod } from "@/types/database";

interface PedidoLista {
  id: string;
  status: OrderStatus;
  quantity: number;
  total_amount: number;
  payment_method: PaymentMethod;
  created_at: string;
  espaco_id: string | null;
  pessoa: { nome_completo: string } | null;
  evento: { nome: string; data_inicio: string } | null;
  ticket_type: { name: string } | null;
  espaco: { nome: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

const STATUS_TONE: Record<string, StatusTone> = {
  pending: "warning",
  paid: "success",
  canceled: "neutral",
  refunded: "info",
};

const PAGAMENTO_LABEL: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão",
};

const FILTROS = [
  { valor: "todos", label: "Todos" },
  { valor: "pending", label: "Aguardando" },
  { valor: "paid", label: "Pagos" },
  { valor: "canceled", label: "Cancelados" },
] as const;

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

export function PedidosView({ demoMode = false }: { demoMode?: boolean }) {
  const [pedidos, setPedidos] = useState<PedidoLista[] | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["valor"]>("todos");
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setPedidos(await api<PedidoLista[]>("/api/tenant/pedidos"));
    } catch (err) {
      toast.error("Falha ao carregar pedidos", { description: (err as Error).message });
      setPedidos([]);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    if (!pedidos) return [];
    const termo = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (filtro !== "todos" && p.status !== filtro) return false;
      if (!termo) return true;
      return [p.pessoa?.nome_completo ?? "", p.evento?.nome ?? ""].some((campo) =>
        campo.toLowerCase().includes(termo),
      );
    });
  }, [pedidos, busca, filtro]);

  const pendentes = useMemo(
    () => (pedidos ?? []).filter((p) => p.status === "pending").length,
    [pedidos],
  );

  async function acao(pedido: PedidoLista, tipo: "confirmar" | "cancelar") {
    setProcessando(pedido.id);
    try {
      await api(`/api/tenant/pedidos/${pedido.id}/${tipo}`, { method: "POST" });
      toast.success(tipo === "confirmar" ? "Pagamento confirmado" : "Pedido cancelado");
      await carregar();
    } catch (err) {
      toast.error(
        tipo === "confirmar" ? "Não foi possível confirmar" : "Não foi possível cancelar",
        {
          description: (err as Error).message,
        },
      );
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <p className="text-sm text-muted-foreground">
          {pedidos === null
            ? "Carregando…"
            : pendentes > 0
              ? `${filtrados.length} pedido(s) · ${pendentes} aguardando pagamento`
              : `${filtrados.length} pedido(s)`}
        </p>
      </div>

      {demoMode ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-dashed border-info/40 bg-info/5 p-3 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-info" />
          <p className="text-info">
            <strong>Modo demonstração ativo.</strong> Pedidos aguardando pagamento podem ser
            confirmados (gera os ingressos) ou cancelados (devolve os lugares) manualmente.
          </p>
        </div>
      ) : null}

      <Toolbar className="mb-4">
        <ToolbarSearch
          value={busca}
          onValueChange={setBusca}
          placeholder="Buscar por cliente ou evento…"
        />
        <div className="flex flex-wrap gap-1">
          {FILTROS.map((f) => (
            <Button
              key={f.valor}
              type="button"
              size="sm"
              variant={filtro === f.valor ? "default" : "outline"}
              onClick={() => setFiltro(f.valor)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </Toolbar>

      {pedidos === null ? (
        <Card>
          <CardContent className="space-y-3 py-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ) : pedidos.length === 0 ? (
        <EmptyState
          icon="file"
          title="Nenhum pedido ainda"
          description="Os pedidos criados no portal do cliente aparecem aqui."
        />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nenhum resultado"
          description="Ajuste a busca ou o filtro de status."
          actions={
            <Button
              variant="outline"
              onClick={() => {
                setBusca("");
                setFiltro("todos");
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Evento</TableHead>
                <TableHead className="hidden lg:table-cell">Item</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                {demoMode ? <TableHead className="text-right">Ações</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(p.created_at)}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{p.pessoa?.nome_completo ?? "—"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {PAGAMENTO_LABEL[p.payment_method] ?? p.payment_method} · {p.quantity}{" "}
                      ingresso(s)
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span>{p.evento?.nome ?? "—"}</span>
                    {p.evento?.data_inicio ? (
                      <span className="block text-xs text-muted-foreground">
                        {new Date(p.evento.data_inicio).toLocaleDateString("pt-BR")}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {p.espaco ? `Ambiente: ${p.espaco.nome}` : (p.ticket_type?.name ?? "—")}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-right font-medium tabular-nums">
                    {formatCurrency(Number(p.total_amount))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={STATUS_TONE[p.status] ?? "neutral"}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </StatusBadge>
                  </TableCell>
                  {demoMode ? (
                    <TableCell className="text-right">
                      {p.status === "pending" ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            disabled={processando === p.id}
                            onClick={() => void acao(p, "confirmar")}
                          >
                            <Check className="size-4" /> Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive"
                            disabled={processando === p.id}
                            onClick={() => void acao(p, "cancelar")}
                          >
                            <X className="size-4" /> Cancelar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
