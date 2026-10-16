"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, CheckCircle2, CreditCard, MapPin, QrCode, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
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
      <Card className="border-green-600/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-500">
            <CheckCircle2 className="size-5" /> Pedido registrado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            {pedido.quantity} ingresso(s) para <strong>{dados.evento.nome}</strong> ·{" "}
            {formatCurrency(Number(pedido.total_amount))} via{" "}
            {PAGAMENTO_LABEL[pedido.payment_method]}
          </p>
          <p className="text-muted-foreground">
            Status: <Badge variant="outline">Aguardando pagamento</Badge>
          </p>
          <p className="text-muted-foreground">
            Após a confirmação do pagamento, seus ingressos aparecerão em{" "}
            <strong>Meus Ingressos</strong> com o QR Code para check-in.
          </p>
          <div className="flex gap-2 pt-1">
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

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-1">
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
            <Ticket className="size-4" /> Escolha seu ingresso
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {dados.lotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este evento ainda não tem ingressos à venda. Volte em breve!
            </p>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="lote">Lote</Label>
                <Select value={loteId} onValueChange={(v) => setLoteId(v as string)}>
                  <SelectTrigger id="lote" className="w-full">
                    <SelectValue placeholder="Selecione o lote…" />
                  </SelectTrigger>
                  <SelectContent>
                    {dados.lotes.map((l) => {
                      const disp = Math.max(0, l.quantity_total - l.quantity_sold);
                      return (
                        <SelectItem key={l.id} value={l.id} disabled={disp === 0}>
                          {l.name} — {formatCurrency(Number(l.price))}
                          {disp === 0 ? " (esgotado)" : ` (${disp} disponíveis)`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="quantidade">Quantidade</Label>
                <Select value={String(qtd)} onValueChange={(v) => setQuantidade(v as string)}>
                  <SelectTrigger id="quantidade" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      { length: Math.min(10, Math.max(1, disponivel)) },
                      (_, i) => i + 1,
                    ).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {qtd} × {formatCurrency(Number(lote?.price ?? 0))}
                  </span>
                  <span className="text-lg font-semibold">{formatCurrency(total)}</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleComprar}
                disabled={enviando || !lote || disponivel === 0}
              >
                {enviando ? "Processando…" : "Confirmar pedido"}
              </Button>
              <p className="text-xs text-muted-foreground">
                O pagamento é confirmado pelo estabelecimento. Seus ingressos ficam disponíveis em
                &quot;Meus Ingressos&quot; após a confirmação.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
