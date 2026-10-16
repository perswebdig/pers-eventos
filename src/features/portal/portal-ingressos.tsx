"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Clock, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { encodeIngressoQr } from "@/features/checkin/qr";
import { formatCurrency, formatDateTime } from "@/lib/format";
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

const STATUS_TONE: Record<string, string> = {
  pending: "border-amber-500/40 text-amber-600 dark:text-amber-500",
  paid: "border-green-600/30 text-green-700 dark:text-green-500",
  canceled: "border-muted-foreground/30 text-muted-foreground",
  refunded: "border-blue-500/30 text-blue-600 dark:text-blue-400",
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
      {pedidos.map((pedido) => (
        <Card key={pedido.id}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Ticket className="size-4" />
                {pedido.evento?.nome ?? "Evento"}
              </CardTitle>
              <Badge variant="outline" className={STATUS_TONE[pedido.status] ?? ""}>
                {STATUS_LABEL[pedido.status] ?? pedido.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {pedido.ticket_type?.name ?? "Lote"} · {pedido.quantity} ingresso(s) ·{" "}
              {formatCurrency(Number(pedido.total_amount))}
            </p>
          </CardHeader>
          <CardContent>
            {pedido.status !== "paid" || pedido.tickets.length === 0 ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-3.5" />
                {pedido.status === "pending"
                  ? "Os QR Codes aparecem aqui após a confirmação do pagamento."
                  : "Sem ingressos para este pedido."}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {pedido.tickets.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col items-center gap-2 rounded-lg border p-3"
                  >
                    <div className="rounded-lg bg-white p-3 shadow">
                      <QRCodeSVG value={encodeIngressoQr(t.qr_code_hash)} size={156} />
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        t.is_checked_in
                          ? "border-green-600/30 text-green-700 dark:text-green-500"
                          : "text-muted-foreground"
                      }
                    >
                      {t.is_checked_in ? (
                        <>
                          <CheckCircle2 className="size-3" /> Utilizado em{" "}
                          {formatDateTime(t.checked_in_at)}
                        </>
                      ) : (
                        "Válido para check-in"
                      )}
                    </Badge>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {t.qr_code_hash.slice(0, 16)}…
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

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
