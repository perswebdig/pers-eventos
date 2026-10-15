"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { encodeInscricaoQr } from "@/features/checkin/qr";
import type { Evento, Inscricao } from "@/types/database";

type InscricaoComEvento = Inscricao & { evento: Evento | null };

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
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
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
        <Card key={i.id}>
          <CardContent className="flex flex-col items-center gap-3 pt-4">
            <div className="text-center">
              <p className="font-medium">{i.evento?.nome ?? "Evento"}</p>
              {i.evento ? (
                <p className="text-xs text-muted-foreground">
                  {new Date(i.evento.data_inicio).toLocaleDateString("pt-BR")}
                </p>
              ) : null}
            </div>
            <div className="rounded-lg bg-white p-3 shadow">
              <QRCodeSVG value={encodeInscricaoQr(i.id)} size={168} />
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              {i.id.slice(0, 8)}…
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
