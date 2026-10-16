"use client";

import { CheckCircle2, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { TicketDetalhe } from "@/db/repos/ingressos";
import { formatCurrency, formatDateTime } from "@/lib/format";

// Cartão de conferência de um ingresso (QR "PERS2:<hash>").
// O check-in é registrado localmente (Dexie) e sincronizado depois.
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
      className={
        usado
          ? "relative overflow-hidden border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20"
          : "relative overflow-hidden border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20"
      }
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
        onClick={onClose}
      >
        <X className="size-4" />
      </Button>
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{pessoa?.nome_completo ?? "—"}</h3>
          <Badge
            variant="outline"
            className={
              usado
                ? "border-amber-500/40 text-amber-700 dark:text-amber-500"
                : "border-green-600/30 text-green-700 dark:text-green-500"
            }
          >
            {usado ? "Já utilizado" : "Válido"}
          </Badge>
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
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={() => onCheckin(ticket.id)}
          >
            <CheckCircle2 className="size-4" /> Fazer check-in
          </Button>
        )}
      </div>
    </Card>
  );
}
