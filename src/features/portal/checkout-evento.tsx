"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  QrCode,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "cn";
import type { Evento, Order, TicketType } from "@/types/database";

type EventoComLotes = { evento: Evento; lotes: TicketType[] };

const PAGAMENTO_LABEL: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
};

export function PortalCheckout() {
  const params = useParams<{ id: string }>();
  const eventoId = params?.id ?? "";

  const [dados, setDados] = useState<EventoComLotes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loteId, setLoteId] = useState<string>("");
  const [quantidade, setQuantidade] = useState("1");
  const [pagamento, setPagamento] = useState<"pix" | "credit_card">("pix");
  const [enviando, setEnviando] = useState(false);
  const [pedido, setPedido] = useState<Order | null>(null);

  useEffect(() => {
    if (!eventoId) return;
    let ativo = true;
    fetch(`/api/portal/eventos/${eventoId}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((body as { error?: string }).error ?? "Erro ao carregar");
        if (ativo) {
          const data = (body as { data: EventoComLotes }).data;
          setDados(data);
          setLoteId(data.lotes[0]?.id ?? "");
        }
      })
      .catch((err: Error) => {
        if (ativo) setErro(err.message);
      });
    return () => {
      ativo = false;
    };
  }, [eventoId]);

  const lote = dados?.lotes.find((l) => l.id === loteId) ?? null;
  const disponivel = lote ? Math.max(0, lote.quantity_total - lote.quantity_sold) : 0;
  const maxQtd = Math.min(10, Math.max(1, disponivel));
  const qtd = Math.min(Math.max(1, Number(quantidade) || 1), Math.min(10, disponivel || 1));
  const total = lote ? Math.round(Number(lote.price) * qtd * 100) / 100 : 0;

  async function handleComprar() {
    if (!lote) {
      toast.error("Selecione um lote.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_type_id: lote.id,
          quantity: qtd,
          payment_method: pagamento,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao criar pedido");
      setPedido((body as { data: Order }).data);
      toast.success("Pedido criado!");
    } catch (err) {
      toast.error("Não foi possível concluir a compra", {
        description: (err as Error).message,
      });
    } finally {
      setEnviando(false);
    }
  }

  if (erro) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{erro}</p>
          <Button
            className="mt-3"
            variant="outline"
            render={<Link href="/portal/eventos">Voltar aos eventos</Link>}
          >
            Voltar aos eventos
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!dados) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (pedido) {
    return (
      <Card className="border-success/30">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-success/12 text-success ring-1 ring-success/25">
            <CheckCircle2 className="size-7" />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Pedido registrado!</h2>
            <p className="text-sm text-muted-foreground">
              {pedido.quantity} ingresso(s) para <strong>{dados.evento.nome}</strong>
            </p>
          </div>
          <div className="w-full max-w-sm space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{formatCurrency(Number(pedido.total_amount))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pagamento</span>
              <span>{PAGAMENTO_LABEL[pedido.payment_method] ?? pedido.payment_method}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge tone="warning">Aguardando pagamento</StatusBadge>
            </div>
          </div>
          <p className="max-w-sm text-xs text-muted-foreground">
            O pagamento é confirmado pelo estabelecimento. Após a confirmação, seus QR Codes de
            check-in aparecerão em <strong>Meus Ingressos</strong>.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button render={<Link href="/portal/ingressos">Ver meus ingressos</Link>}>
              Ver meus ingressos
            </Button>
            <Button variant="outline" render={<Link href="/portal/eventos">Mais eventos</Link>}>
              Mais eventos
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const temLotes = dados.lotes.length > 0;

  return (
    <div className="space-y-4 pb-40 sm:pb-0">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        render={
          <Link href="/portal/eventos">
            <ArrowLeft className="size-4" /> Voltar aos eventos
          </Link>
        }
      >
        Voltar aos eventos
      </Button>

      <Card>
        <CardContent className="space-y-1.5 pt-6">
          <h1 className="text-lg font-semibold">{dados.evento.nome}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {formatDate(dados.evento.data_inicio)}
            </span>
            {dados.evento.local ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {dados.evento.local}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="size-4 text-primary" /> Escolha seu ingresso
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!temLotes ? (
            <p className="text-sm text-muted-foreground">
              Este evento ainda não tem ingressos à venda. Volte em breve!
            </p>
          ) : (
            <>
              <div role="radiogroup" aria-label="Lote" className="grid gap-2">
                {dados.lotes.map((l) => {
                  const disp = Math.max(0, l.quantity_total - l.quantity_sold);
                  const esgotado = disp === 0;
                  const selecionado = l.id === loteId;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={selecionado}
                      disabled={esgotado}
                      onClick={() => {
                        setLoteId(l.id);
                        setQuantidade("1");
                      }}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                        selecionado
                          ? "border-primary/50 bg-primary/8 ring-1 ring-primary/30"
                          : "hover:border-primary/30 hover:bg-muted/50",
                        esgotado && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium">{l.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {esgotado ? "Esgotado" : `${disp} disponível(is)`}
                        </span>
                      </span>
                      <span className="text-sm font-semibold">
                        {formatCurrency(Number(l.price))}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Quantidade</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Diminuir quantidade"
                      disabled={qtd <= 1}
                      onClick={() => setQuantidade(String(qtd - 1))}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-8 text-center text-lg font-semibold tabular-nums">
                      {qtd}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Aumentar quantidade"
                      disabled={qtd >= maxQtd}
                      onClick={() => setQuantidade(String(qtd + 1))}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label>Forma de pagamento</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={pagamento === "pix" ? "default" : "outline"}
                      onClick={() => setPagamento("pix")}
                    >
                      <QrCode className="size-4" /> Pix
                    </Button>
                    <Button
                      type="button"
                      variant={pagamento === "credit_card" ? "default" : "outline"}
                      onClick={() => setPagamento("credit_card")}
                    >
                      <CreditCard className="size-4" /> Cartão
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {qtd} × {formatCurrency(Number(lote?.price ?? 0))}
                  </span>
                  <span className="text-lg font-semibold">{formatCurrency(total)}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                O pagamento é confirmado pelo estabelecimento. Seus ingressos ficam disponíveis em
                &quot;Meus Ingressos&quot; após a confirmação.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {temLotes ? (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t bg-background/95 p-4 backdrop-blur md:sticky md:bottom-4 md:inset-x-auto md:rounded-xl md:border md:p-4">
          <div className="mx-auto flex max-w-3xl items-center gap-3 md:max-w-none">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                Total · {qtd} ingresso(s) · {PAGAMENTO_LABEL[pagamento]}
              </p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(total)}</p>
            </div>
            <Button
              size="lg"
              onClick={handleComprar}
              disabled={enviando || !lote || disponivel === 0}
            >
              {enviando ? "Processando…" : "Confirmar pedido"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
