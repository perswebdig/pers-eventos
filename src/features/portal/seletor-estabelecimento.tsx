"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Estabelecimento } from "@/types/database";

type EstabelecimentoResumo = Pick<
  Estabelecimento,
  "id" | "nome" | "cidade" | "estado" | "endereco"
>;

function localDoEstabelecimento(e: EstabelecimentoResumo): string | null {
  const partes = [e.cidade, e.estado].filter(Boolean);
  if (partes.length > 0) return partes.join(" · ");
  return e.endereco ?? null;
}

function ListaEstabelecimentos({
  estabelecimentos,
  selecionando,
  atualId,
  onSelecionar,
}: {
  estabelecimentos: EstabelecimentoResumo[];
  selecionando: string | null;
  atualId?: string | null;
  onSelecionar: (id: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {estabelecimentos.map((e) => {
        const atual = e.id === atualId;
        const carregando = selecionando === e.id;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onSelecionar(e.id)}
            disabled={!!selecionando || atual}
            className="flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 disabled:opacity-60"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0 space-y-0.5">
                <span className="block truncate text-sm font-medium">{e.nome}</span>
                {localDoEstabelecimento(e) ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    {localDoEstabelecimento(e)}
                  </span>
                ) : null}
              </span>
            </span>
            {carregando ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : atual ? (
              <Check className="size-4 shrink-0 text-success" />
            ) : (
              <span className="shrink-0 text-xs font-medium text-primary">Selecionar</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Seletor de estabelecimento do portal do cliente.
//   onboarding: lista para escolher o estabelecimento ativo (primeiro acesso).
//   trocar: botão + diálogo para trocar o estabelecimento ativo.
export function SeletorEstabelecimento({
  modo,
  temPessoa = false,
  atualId,
  atualNome,
}: {
  modo: "onboarding" | "trocar";
  temPessoa?: boolean;
  atualId?: string | null;
  atualNome?: string | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [estabelecimentos, setEstabelecimentos] = useState<EstabelecimentoResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionando, setSelecionando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    setEstabelecimentos(null);
    try {
      const res = await fetch("/api/portal/estabelecimentos");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao carregar");
      setEstabelecimentos((body as { data: EstabelecimentoResumo[] }).data ?? []);
    } catch (err) {
      setErro((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function selecionar(id: string) {
    setSelecionando(id);
    try {
      const res = await fetch("/api/portal/estabelecimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estabelecimento_id: id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao selecionar");

      const nome =
        (body as { data?: { nome?: string } }).data?.nome ??
        estabelecimentos?.find((e) => e.id === id)?.nome ??
        "Estabelecimento";
      toast.success(`Estabelecimento selecionado: ${nome}`);
      setAberto(false);

      if (modo === "onboarding" && !temPessoa) {
        router.push("/portal/cadastro");
      } else {
        router.refresh();
      }
    } catch (err) {
      toast.error("Não foi possível selecionar", { description: (err as Error).message });
      void carregar();
    } finally {
      setSelecionando(null);
    }
  }

  const lista =
    estabelecimentos === null ? (
      erro ? (
        <div className="space-y-2 py-2">
          <p className="text-sm text-destructive">{erro}</p>
          <Button variant="outline" size="sm" onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )
    ) : estabelecimentos.length === 0 ? (
      <p className="py-2 text-sm text-muted-foreground">
        Nenhum estabelecimento disponível no momento.
      </p>
    ) : (
      <ListaEstabelecimentos
        estabelecimentos={estabelecimentos}
        selecionando={selecionando}
        atualId={atualId}
        onSelecionar={selecionar}
      />
    );

  if (modo === "onboarding") {
    return (
      <Card>
        <CardContent className="pt-6">{lista}</CardContent>
      </Card>
    );
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Trocar estabelecimento
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trocar estabelecimento</DialogTitle>
          <DialogDescription>
            {atualNome
              ? `Você está navegando em ${atualNome}. Selecione outro para trocar.`
              : "Selecione o estabelecimento para navegar."}
          </DialogDescription>
        </DialogHeader>
        {lista}
      </DialogContent>
    </Dialog>
  );
}
