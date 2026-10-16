"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FileText, Pen, Eye, Download, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { EmptyState, LoadingSkeleton } from "@/components/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listTermos,
  getAssinaturaBlob,
  getTermo,
  registrarLogAcesso,
  listLogsAcesso,
} from "@/db/repos/termos";
import { termoTipoLabel, TERMO_TIPO, type TermoTipo } from "./termo-schema";
import { TermoAceiteSheet } from "./termo-aceite-sheet";
import { formatDate, formatDateTime } from "@/lib/format";

const TIPO_BADGE: Record<TermoTipo, string> = {
  responsabilidade: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  imagem: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

export function TermosView() {
  const [pessoaId, setPessoaId] = useState<string | null>(null);
  const [pessoaNome, setPessoaNome] = useState("");
  const [termoAberto, setTermoAberto] = useState<{
    tipo: TermoTipo;
    eventoId?: string | null;
  } | null>(null);

  const termos = useLiveQuery(() => listTermos(pessoaId ?? undefined), [pessoaId]);

  async function abrirAssinatura(termoId: string) {
    const termo = await getTermo(termoId);
    if (!termo) return;
    const blob = await getAssinaturaBlob(termoId);
    if (!blob) {
      toast.error("Arquivo de assinatura não encontrado.");
      return;
    }
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    await registrarLogAcesso(termo.pessoa_id, "visualizou_assinatura");
  }

  async function baixarAssinatura(termoId: string) {
    const termo = await getTermo(termoId);
    if (!termo) return;
    const blob = await getAssinaturaBlob(termoId);
    if (!blob) {
      toast.error("Arquivo de assinatura não encontrado.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assinatura-${termo.tipo}-${formatDate(termo.aceito_em)}.png`;
    a.click();
    URL.revokeObjectURL(url);
    await registrarLogAcesso(termo.pessoa_id, "baixou_assinatura");
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setTermoAberto({ tipo: "responsabilidade", eventoId: null });
              }}
            >
              <Pen className="size-4" /> Novo Termo de Responsabilidade
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTermoAberto({ tipo: "imagem", eventoId: null });
              }}
            >
              <FileText className="size-4" /> Novo Termo de Imagem
            </Button>
          </div>
        </CardContent>
      </Card>

      {termoAberto && (
        <TermoAceiteSheet
          pessoaId={pessoaId ?? ""}
          pessoaNome={pessoaNome}
          tipo={termoAberto.tipo}
          eventoId={termoAberto.eventoId}
          open
          onOpenChange={(open) => {
            if (!open) setTermoAberto(null);
          }}
        />
      )}

      <Card>
        <CardContent className="pt-4">
          {termos === undefined ? (
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
                      <p className="truncate font-medium">{t.pessoa_id}</p>
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
                      onClick={() => abrirAssinatura(t.id)}
                      aria-label="Ver assinatura"
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => baixarAssinatura(t.id)}
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
          <LogAcessoViewer pessoaId={pessoaId ?? undefined} />
        </CardContent>
      </Card>
    </div>
  );
}

function LogAcessoViewer({ pessoaId }: { pessoaId?: string }) {
  const logs = useLiveQuery(() => listLogsAcesso(pessoaId), [pessoaId]);

  if (logs === undefined) {
    return <LoadingSkeleton count={1} />;
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
