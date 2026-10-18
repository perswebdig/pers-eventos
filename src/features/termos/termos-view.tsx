"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Pen, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingSkeleton } from "@/components/empty-state";
import { termoTipoLabel, type TermoTipo } from "./termo-schema";
import { TermoAceiteSheet } from "./termo-aceite-sheet";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatDateTime } from "@/lib/format";
import type { LogAcessoDados, Pessoa, Termo } from "@/types/database";

const TIPO_BADGE: Record<TermoTipo, string> = {
  responsabilidade: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  imagem: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

export function TermosView() {
  const [pessoaId, setPessoaId] = useState<string | null>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [termos, setTermos] = useState<Termo[] | null>(null);
  const [termoAberto, setTermoAberto] = useState<{
    tipo: TermoTipo;
    eventoId?: string | null;
  } | null>(null);

  const nomesPorId = useMemo(() => new Map(pessoas.map((p) => [p.id, p.nome_completo])), [pessoas]);

  useEffect(() => {
    let ativo = true;
    fetch("/api/pessoas")
      .then((res) => res.json())
      .then((body) => {
        if (ativo) setPessoas((body as { data?: Pessoa[] }).data ?? []);
      })
      .catch(() => {
        if (ativo) setPessoas([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const carregarTermos = useCallback(async () => {
    try {
      const qs = pessoaId ? `?pessoa_id=${pessoaId}` : "";
      const res = await fetch(`/api/termos${qs}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao carregar");
      setTermos((body as { data: Termo[] }).data ?? []);
    } catch (err) {
      setTermos([]);
      toast.error("Não foi possível carregar os termos", { description: (err as Error).message });
    }
  }, [pessoaId]);

  useEffect(() => {
    void carregarTermos();
  }, [carregarTermos]);

  async function registrarLog(pessoaAlvo: string, acao: string) {
    await fetch("/api/logs-acesso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pessoa_id: pessoaAlvo, acao }),
    }).catch(() => {});
  }

  async function abrirAssinatura(termo: Termo) {
    if (!termo.assinatura_url) {
      toast.error("Este termo não possui assinatura registrada.");
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("assinaturas")
      .createSignedUrl(termo.assinatura_url, 300);
    if (error || !data?.signedUrl) {
      toast.error("Arquivo de assinatura não encontrado.");
      return;
    }
    window.open(data.signedUrl, "_blank");
    await registrarLog(termo.pessoa_id, "visualizou_assinatura");
  }

  async function baixarAssinatura(termo: Termo) {
    if (!termo.assinatura_url) {
      toast.error("Este termo não possui assinatura registrada.");
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("assinaturas")
      .createSignedUrl(termo.assinatura_url, 60, {
        download: `assinatura-${termo.tipo}-${formatDate(termo.aceito_em)}.png`,
      });
    if (error || !data?.signedUrl) {
      toast.error("Arquivo de assinatura não encontrado.");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = `assinatura-${termo.tipo}-${formatDate(termo.aceito_em)}.png`;
    a.click();
    await registrarLog(termo.pessoa_id, "baixou_assinatura");
  }

  function abrirNovoTermo(tipo: TermoTipo) {
    if (!pessoaId) {
      toast.error("Selecione uma pessoa primeiro.");
      return;
    }
    setTermoAberto({ tipo, eventoId: null });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Termos & LGPD</h1>

      <Card className="mb-4">
        <CardContent className="pt-6 grid gap-3">
          <p className="text-sm text-muted-foreground">
            Gerencie os termos aceitos pelos participantes. Selecione uma pessoa para filtrar ou
            cadastre um novo aceite.
          </p>
          <div className="grid gap-1.5">
            <Select value={pessoaId ?? ""} onValueChange={(v) => setPessoaId(v || null)}>
              <SelectTrigger className="w-full" aria-label="Selecionar pessoa">
                <SelectValue placeholder="Todas as pessoas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas as pessoas</SelectItem>
                {pessoas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => abrirNovoTermo("responsabilidade")}>
              <Pen className="size-4" /> Novo Termo de Responsabilidade
            </Button>
            <Button variant="outline" onClick={() => abrirNovoTermo("imagem")}>
              <FileText className="size-4" /> Novo Termo de Imagem
            </Button>
          </div>
        </CardContent>
      </Card>

      {termoAberto && pessoaId && (
        <TermoAceiteSheet
          pessoaId={pessoaId}
          pessoaNome={nomesPorId.get(pessoaId) ?? ""}
          tipo={termoAberto.tipo}
          eventoId={termoAberto.eventoId}
          open
          onOpenChange={(open) => {
            if (!open) setTermoAberto(null);
          }}
          onSuccess={() => void carregarTermos()}
        />
      )}

      <Card>
        <CardContent className="pt-4">
          {termos === null ? (
            <LoadingSkeleton count={2} />
          ) : termos.length === 0 ? (
            <EmptyState
              icon="file"
              title="Nenhum termo aceito"
              description={
                pessoaId
                  ? "Esta pessoa ainda não aceitou nenhum termo."
                  : "Selecione uma pessoa ou cadastre um aceite."
              }
            />
          ) : (
            <ul className="space-y-2">
              {termos.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={TIPO_BADGE[t.tipo]}>{termoTipoLabel(t.tipo)}</Badge>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {nomesPorId.get(t.pessoa_id) ?? `${t.pessoa_id.slice(0, 8)}…`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Aceito em {formatDateTime(t.aceito_em)}
                        {t.evento_id ? ` · Evento ${t.evento_id.slice(0, 8)}…` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => abrirAssinatura(t)}
                      aria-label="Ver assinatura"
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => baixarAssinatura(t)}
                      aria-label="Baixar assinatura"
                    >
                      <Download className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="pt-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Log de acesso a dados (LGPD)
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Registros de quem visualizou/baixou assinaturas ou acessou dados sensíveis.
          </p>
          <LogAcessoViewer pessoaId={pessoaId} />
        </CardContent>
      </Card>
    </div>
  );
}

function LogAcessoViewer({ pessoaId }: { pessoaId: string | null }) {
  const [logs, setLogs] = useState<LogAcessoDados[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setLogs(null);
    setErro(null);
    const qs = pessoaId ? `?pessoa_id=${pessoaId}` : "";
    fetch(`/api/logs-acesso${qs}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro");
        return (body as { data: LogAcessoDados[] }).data ?? [];
      })
      .then((data) => {
        if (ativo) setLogs(data);
      })
      .catch((err: Error) => {
        if (!ativo) return;
        setLogs([]);
        setErro(err.message);
      });
    return () => {
      ativo = false;
    };
  }, [pessoaId]);

  if (logs === null) {
    return <LoadingSkeleton count={1} />;
  }
  if (erro) {
    return (
      <p className="text-sm text-muted-foreground">
        Logs de acesso visíveis apenas para o administrador do estabelecimento.
      </p>
    );
  }
  if (logs.length === 0) {
    return (
      <EmptyState
        icon="activity"
        title="Nenhum acesso registrado"
        description="Os acessos a dados sensíveis aparecerão aqui."
      />
    );
  }

  return (
    <ul className="space-y-1 max-h-60 overflow-auto">
      {logs.map((l) => (
        <li key={l.id} className="flex items-center justify-between text-sm py-1">
          <span className="text-muted-foreground">{formatDateTime(l.criado_em)}</span>
          <span className="font-medium">{l.acao}</span>
          <span className="text-xs text-muted-foreground">
            {l.pessoa_id ? `Pessoa ${l.pessoa_id.slice(0, 8)}…` : "Sistema"} ·{" "}
            {l.user_id ? `User ${l.user_id.slice(0, 8)}…` : "Anônimo"}
          </span>
        </li>
      ))}
    </ul>
  );
}
