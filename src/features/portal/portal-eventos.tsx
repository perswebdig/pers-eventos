"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import type { Evento, Inscricao } from "@/types/database";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro");
  return (body as { data: T }).data;
}

export function PortalEventos() {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [inscritos, setInscritos] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [ev, ins] = await Promise.all([
        getJson<Evento[]>("/api/portal/eventos"),
        getJson<Inscricao[]>("/api/portal/inscricoes"),
      ]);
      setEventos(ev);
      setInscritos(new Set(ins.map((i) => i.evento_id)));
    } catch (err) {
      toast.error("Falha ao carregar eventos", {
        description: (err as Error).message,
      });
      setEventos([]);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function inscrever(eventoId: string) {
    setEnviando(eventoId);
    try {
      const res = await fetch("/api/portal/inscricoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento_id: eventoId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro");
      toast.success("Inscrição confirmada!");
      setInscritos((prev) => new Set(prev).add(eventoId));
    } catch (err) {
      toast.error("Não foi possível inscrever", {
        description: (err as Error).message,
      });
    } finally {
      setEnviando(null);
    }
  }

  if (eventos === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <EmptyState
        icon="calendar"
        title="Nenhum evento disponível"
        description="Novos eventos do estabelecimento aparecerão aqui."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {eventos.map((e) => {
        const jaInscrito = inscritos.has(e.id);
        return (
          <li key={e.id}>
            <Card>
              <CardContent className="flex items-start justify-between gap-3 pt-4">
                <div className="space-y-1">
                  <p className="font-medium">{e.nome}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {new Date(e.data_inicio).toLocaleDateString("pt-BR")}
                    </span>
                    {e.local ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {e.local}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    render={
                      <Link href={`/portal/eventos/${e.id}`}>
                        <Ticket className="size-4" /> Comprar
                      </Link>
                    }
                  >
                    Comprar
                  </Button>
                  {jaInscrito ? (
                    <Badge
                      variant="outline"
                      className="border-green-600/30 text-green-700 dark:text-green-500"
                    >
                      Inscrito
                    </Badge>
                  ) : (
                    <Button size="sm" disabled={enviando === e.id} onClick={() => inscrever(e.id)}>
                      Inscrever-se
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
