"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Toolbar, ToolbarSearch } from "@/components/toolbar";
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
  const [termo, setTermo] = useState("");

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

  const filtrados = useMemo(() => {
    if (!eventos) return eventos;
    const busca = termo.trim().toLowerCase();
    if (!busca) return eventos;
    return eventos.filter(
      (evento) =>
        evento.nome.toLowerCase().includes(busca) ||
        (evento.local ?? "").toLowerCase().includes(busca),
    );
  }, [eventos, termo]);

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
    <>
      <Toolbar className="mb-4">
        <ToolbarSearch
          value={termo}
          onValueChange={setTermo}
          placeholder="Buscar por nome ou local"
        />
      </Toolbar>

      {filtrados && filtrados.length === 0 ? (
        <EmptyState
          icon="search"
          title="Nenhum resultado"
          description="Tente outro nome ou local."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {(filtrados ?? []).map((evento) => {
            const jaInscrito = inscritos.has(evento.id);
            return (
              <li key={evento.id}>
                <Card className="h-full gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{evento.nome}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3.5" />
                          {new Date(evento.data_inicio).toLocaleDateString("pt-BR")}
                        </span>
                        {evento.local ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" />
                            {evento.local}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {jaInscrito ? <StatusBadge tone="success">Inscrito</StatusBadge> : null}
                  </div>

                  <div className="mt-auto flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      render={
                        <Link href={`/portal/eventos/${evento.id}`}>
                          <Ticket className="size-4" /> Comprar
                        </Link>
                      }
                    />
                    {!jaInscrito ? (
                      <Button
                        size="sm"
                        disabled={enviando === evento.id}
                        onClick={() => inscrever(evento.id)}
                      >
                        Inscrever-se
                      </Button>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
