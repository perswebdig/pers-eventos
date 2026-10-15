"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TERMO_TIPO,
  termoTexto,
  type TermoTipo,
} from "@/features/termos/termo-schema";
import type { Termo } from "@/types/database";

export function PortalTermos() {
  const [termos, setTermos] = useState<Termo[] | null>(null);
  const [enviando, setEnviando] = useState<TermoTipo | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/termos");
      const body = (await res.json()) as { data: Termo[] };
      setTermos(body.data ?? []);
    } catch {
      setTermos([]);
      toast.error("Falha ao carregar termos");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function aceitar(tipo: TermoTipo) {
    setEnviando(tipo);
    try {
      const res = await fetch("/api/portal/termos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro");
      toast.success("Termo aceito");
      await carregar();
    } catch (err) {
      toast.error("Não foi possível aceitar", {
        description: (err as Error).message,
      });
    } finally {
      setEnviando(null);
    }
  }

  if (termos === null) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="space-y-3">
      {TERMO_TIPO.map(({ value: tipo, label }) => {
        const aceito = termos.find((t) => t.tipo === tipo);
        return (
          <Card key={tipo}>
            <CardContent className="flex items-start justify-between gap-3 pt-4">
              <div className="space-y-1">
                <p className="inline-flex items-center gap-2 font-medium">
                  <FileText className="size-4 text-muted-foreground" />
                  {label}
                </p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {termoTexto[tipo]}
                </p>
              </div>
              {aceito ? (
                <Badge
                  variant="outline"
                  className="shrink-0 border-green-600/30 text-green-700 dark:text-green-500"
                >
                  <ShieldCheck className="mr-1 size-3.5" /> Aceito
                </Badge>
              ) : (
                <Button
                  size="sm"
                  className="shrink-0"
                  disabled={enviando === tipo}
                  onClick={() => aceitar(tipo)}
                >
                  Aceitar
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
