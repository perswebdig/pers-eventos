"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Clock, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { encodeIngressoQr } from "@/features/checkin/qr";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "cn";
import type { Evento, Order, Ticket as TicketRow, TicketType } from "@/types/database";

type PedidoCompleto = Order & {
  evento: Evento | null;
  ticket_type: TicketType | null;
  tickets: TicketRow[];
};

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

export function PortalIngressos() {
  const [pedidos, setPedidos] = useState<PedidoCompleto[] | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/portal/pedidos")
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((body as { error?: string }).error ?? "Erro");
        if (ativo) setPedidos((body as { data: PedidoCompleto[] }).data ?? []);
      })
      .catch(() => {
        if (ativo) {
          setPedidos([]);
          toast.error("Falha ao carregar seus ingressos");
        }
      });
    return () => {
      ativo = false;
    };
  }, []);

  if (pedidos === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <EmptyState
        icon="calendar"
        title="Nenhum ingresso ainda"
        description="Compre ingressos em um evento e eles aparecerão aqui com o QR Code para check-in."
      />
    );
  }

  return (
    <div className="space-y-4">
      {pedidos.map((pedido) => {
        const pago = pedido.status === "paid";
        return (
          <Card key={pedido.id} className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Ticket className="size-4 text-primary" />
                  {pedido.evento?.nome ?? "Evento"}
                </CardTitle>
                <StatusBadge tone={STATUS_TONE[pedido.status] ?? "neutral"}>
                  {STATUS_LABEL[pedido.status] ?? pedido.status}
                </StatusBadge>
              </div>
              <p className="text-xs text-muted-foreground">
                {pedido.ticket_type?.name ?? "Lote"} · {pedido.quantity} ingresso(s) ·{" "}
                {formatCurrency(Number(pedido.total_amount))}
                {pedido.evento?.data_inicio
                  ? ` · ${new Date(pedido.evento.data_inicio).toLocaleDateString("pt-BR")}`
                  : ""}
              </p>
            </CardHeader>

            <div className="p-4">
              {!pago || pedido.tickets.length === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="size-3.5" />
                  {pedido.status === "pending"
                    ? "Os QR Codes aparecem aqui após a confirmação do pagamento."
                    : "Sem ingressos para este pedido."}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {pedido.tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className={cn(
                        "relative overflow-hidden rounded-xl border border-l-4 bg-card p-4",
                        ticket.is_checked_in ? "border-l-warning" : "border-l-success",
                      )}
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-lg bg-white p-3 shadow-sm">
                          <QRCodeSVG value={encodeIngressoQr(ticket.qr_code_hash)} size={156} />
                        </div>
                        <StatusBadge tone={ticket.is_checked_in ? "warning" : "success"}>
                          {ticket.is_checked_in ? (
                            <>
                              <CheckCircle2 className="size-3" /> Utilizado em{" "}
                              {formatDateTime(ticket.checked_in_at)}
                            </>
                          ) : (
                            "Válido para check-in"
                          )}
                        </StatusBadge>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {ticket.qr_code_hash.slice(0, 16)}…
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        );
      })}

      <div className="flex justify-center">
        <Button
          variant="outline"
          render={<Link href="/portal/eventos">Comprar mais ingressos</Link>}
        >
          Comprar mais ingressos
        </Button>
      </div>
    </div>
  );
}
