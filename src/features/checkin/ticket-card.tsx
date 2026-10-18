"use client";

import { CheckCircle2, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import type { TicketDetalhe } from "./tipos";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "cn";

// Cartão de conferência de um ingresso (QR "PERS2:<hash>").
export function TicketActionCard({
  det,
  onClose,
  onCheckin,
}: {
  det: TicketDetalhe;
  onClose: () => void;
  onCheckin: (ticketId: string) => void;
}) {
  const { ticket, pessoa, lote, eventoNome } = det;
  const usado = ticket.is_checked_in;

  return (
    <Card
      className={cn(
        "relative gap-2 overflow-hidden border-l-4 p-4",
        usado ? "border-l-warning" : "border-l-success",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
        onClick={onClose}
        aria-label="Fechar"
      >
        <X className="size-4" />
      </Button>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2 pr-8">
          <h3 className="truncate text-lg font-semibold">{pessoa?.nome_completo ?? "—"}</h3>
          <StatusBadge tone={usado ? "warning" : "success"}>
            {usado ? "Já utilizado" : "Válido"}
          </StatusBadge>
        </div>
        {pessoa?.cpf ? <p className="text-sm text-muted-foreground">CPF: {pessoa.cpf}</p> : null}
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Ticket className="size-3.5" />
          {eventoNome ?? "Evento não encontrado"}
          {lote ? ` · ${lote.name} · ${formatCurrency(Number(lote.price))}` : ""}
        </p>
        <div className="border-t pt-2 text-xs text-muted-foreground">
          <span className="font-medium">Check-in:</span> {formatDateTime(ticket.checked_in_at)}
        </div>
        <Separator />
        {usado ? (
          <p className="text-sm text-muted-foreground">
            Este ingresso já teve entrada registrada. Em caso de dúvida, verifique com o
            organizador.
          </p>
        ) : (
          <Button
            size="lg"
            className="w-full bg-success text-success-foreground hover:bg-success/90"
            onClick={() => onCheckin(ticket.id)}
          >
            <CheckCircle2 className="size-5" /> Liberar entrada
          </Button>
        )}
      </div>
    </Card>
  );
}
