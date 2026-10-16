"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { encodeInscricaoQr } from "@/features/checkin/qr";
import { formatDate } from "@/lib/format";
import type { Evento, Inscricao } from "@/types/database";

type InscricaoComEvento = Inscricao & { evento: Evento | null };

const STATUS_INFO: Record<Inscricao["status"], { label: string; tone: StatusTone }> = {
  inscrito: { label: "Inscrição ativa", tone: "success" },
  confirmado: { label: "Confirmada", tone: "success" },
  checkin: { label: "Check-in realizado", tone: "warning" },
  checkout: { label: "Check-out realizado", tone: "neutral" },
  cancelado: { label: "Cancelada", tone: "neutral" },
};

export function PortalQr() {
  const [inscricoes, setInscricoes] = useState<InscricaoComEvento[] | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/portal/inscricoes")
      .then((r) => r.json())
      .then((body: { data: InscricaoComEvento[] }) => {
        if (ativo) setInscricoes(body.data ?? []);
      })
      .catch(() => {
        if (ativo) {
          setInscricoes([]);
          toast.error("Falha ao carregar seus QR Codes");
        }
      });
    return () => {
      ativo = false;
    };
  }, []);

  if (inscricoes === null) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (inscricoes.length === 0) {
    return (
      <EmptyState
        icon="calendar"
        title="Nenhuma inscrição"
        description="Ao se inscrever em um evento, seu QR Code de check-in aparecerá aqui."
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {inscricoes.map((i) => (
        <Card key={i.id} className="border-l-4 border-l-primary/60">
          <CardContent className="flex flex-col items-center gap-3 pt-5">
            <div className="text-center">
              <p className="font-medium">{i.evento?.nome ?? "Evento"}</p>
              {i.evento ? (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="size-3" />
                  {formatDate(i.evento.data_inicio)}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <QRCodeSVG value={encodeInscricaoQr(i.id)} size={168} />
            </div>
            <StatusBadge tone={STATUS_INFO[i.status].tone}>
              {STATUS_INFO[i.status].label}
            </StatusBadge>
            <p className="font-mono text-[10px] text-muted-foreground">{i.id.slice(0, 12)}…</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
