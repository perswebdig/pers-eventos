"use client";

import { useCallback, useEffect, useState } from "react";
import { Armchair, Loader2, Map, Pause, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SeatMap, SeatMapLegend } from "@/features/ingressos/seat-map";
import type { AssentoMapa } from "@/features/ingressos/assentos";
import { espacoFormSchema } from "./espaco-schema";
import { formatCurrency } from "@/lib/format";
import type { Espaco } from "@/types/database";

type EspacoComContagem = Espaco & { livres: number; reservados: number; vendidos: number };

interface FormState {
  nome: string;
  price: string;
  fileiras: string;
  cadeiras_por_fileira: string;
}

const FORM_VAZIO: FormState = { nome: "", price: "", fileiras: "5", cadeiras_por_fileira: "10" };

// Seção "Espaços" do detalhe do evento (Admin do Estabelecimento): setores com
// lugar marcado (grade de fileiras × cadeiras, preço único). Requer conexão —
// o mapa de lugares é controlado pelo servidor.
export function EspacosSection({ eventoId }: { eventoId: string }) {
  const [espacos, setEspacos] = useState<EspacoComContagem[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [removerId, setRemoverId] = useState<string | null>(null);

  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [mapas, setMapas] = useState<Record<string, AssentoMapa[]>>({});
  const [mapaCarregando, setMapaCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch(`/api/tenant/espacos?event_id=${eventoId}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao carregar");
      setEspacos((body as { data: EspacoComContagem[] }).data);
    } catch (err) {
      setEspacos(null);
      setErro((err as Error).message);
    }
  }, [eventoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function carregarMapa(espacoId: string) {
    setMapaCarregando(true);
    try {
      const res = await fetch(`/api/tenant/espacos/${espacoId}/assentos`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao carregar mapa");
      setMapas((prev) => ({
        ...prev,
        [espacoId]: (body as { data: { assentos: AssentoMapa[] } }).data.assentos,
      }));
    } catch (err) {
      toast.error("Não foi possível carregar o mapa", { description: (err as Error).message });
    } finally {
      setMapaCarregando(false);
    }
  }

  function toggleMapa(espacoId: string) {
    if (expandidoId === espacoId) {
      setExpandidoId(null);
      return;
    }
    setExpandidoId(espacoId);
    if (!mapas[espacoId]) void carregarMapa(espacoId);
  }

  async function handleCriar() {
    if (!form) return;
    const parsed = espacoFormSchema.safeParse(form);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErros(
        Object.fromEntries(
          Object.entries(flat).map(([campo, msgs]) => [campo, msgs?.[0] ?? "Valor inválido."]),
        ),
      );
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Sem conexão", {
        description: "Criar espaços com lugar marcado requer internet.",
      });
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch("/api/tenant/espacos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventoId, ...parsed.data }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao criar espaço");
      toast.success("Espaço criado", {
        description: `${parsed.data.fileiras} fileira(s) × ${parsed.data.cadeiras_por_fileira} cadeira(s).`,
      });
      setForm(null);
      setErros({});
      await carregar();
    } catch (err) {
      toast.error("Não foi possível criar o espaço", { description: (err as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  async function handleToggle(espaco: EspacoComContagem) {
    try {
      const res = await fetch(`/api/tenant/espacos/${espaco.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !espaco.is_active }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao atualizar");
      toast.success(espaco.is_active ? "Espaço pausado" : "Espaço reativado");
      await carregar();
    } catch (err) {
      toast.error("Não foi possível atualizar o espaço", { description: (err as Error).message });
    }
  }

  async function handleRemover() {
    if (!removerId) return;
    try {
      const res = await fetch(`/api/tenant/espacos/${removerId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Erro ao excluir");
      toast.success("Espaço excluído");
      if (expandidoId === removerId) setExpandidoId(null);
      await carregar();
    } catch (err) {
      toast.error("Não foi possível excluir o espaço", { description: (err as Error).message });
    } finally {
      setRemoverId(null);
    }
  }

  const totalCadeiras = form
    ? Math.max(0, (Number(form.fileiras) || 0) * (Number(form.cadeiras_por_fileira) || 0))
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Armchair className="size-3.5" /> Espaços com lugar marcado
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setForm(FORM_VAZIO);
            setErros({});
          }}
        >
          <Plus className="size-3.5" /> Novo espaço
        </Button>
      </div>

      {form ? (
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Novo espaço
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="espaco_nome">Nome do espaço</Label>
            <Input
              id="espaco_nome"
              placeholder="Ex.: Setor A / Pista premium"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
            {erros.nome ? <p className="text-xs text-destructive">{erros.nome}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="espaco_preco">Preço (R$)</Label>
              <Input
                id="espaco_preco"
                inputMode="decimal"
                placeholder="0,00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              {erros.price ? <p className="text-xs text-destructive">{erros.price}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="espaco_fileiras">Fileiras (A–Z)</Label>
              <Input
                id="espaco_fileiras"
                inputMode="numeric"
                placeholder="5"
                value={form.fileiras}
                onChange={(e) => setForm({ ...form, fileiras: e.target.value })}
              />
              {erros.fileiras ? <p className="text-xs text-destructive">{erros.fileiras}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="espaco_cadeiras">Cadeiras por fileira</Label>
              <Input
                id="espaco_cadeiras"
                inputMode="numeric"
                placeholder="10"
                value={form.cadeiras_por_fileira}
                onChange={(e) => setForm({ ...form, cadeiras_por_fileira: e.target.value })}
              />
              {erros.cadeiras_por_fileira ? (
                <p className="text-xs text-destructive">{erros.cadeiras_por_fileira}</p>
              ) : null}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Gera {totalCadeiras} cadeira(s) numerada(s), com fileiras nomeadas de A até{" "}
            {String.fromCharCode(64 + Math.min(26, Math.max(1, Number(form.fileiras) || 1)))}.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCriar} disabled={salvando}>
              {salvando ? "Criando…" : "Criar espaço"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setForm(null)} disabled={salvando}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {erro ? (
        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{erro}</p>
          <p className="text-xs text-muted-foreground">
            Criação de espaços com lugar marcado requer conexão com a internet.
          </p>
          <Button variant="outline" size="sm" onClick={() => void carregar()}>
            <RefreshCw className="size-3.5" /> Tentar novamente
          </Button>
        </div>
      ) : espacos === null ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Carregando espaços…
        </p>
      ) : espacos.length === 0 && !form ? (
        <p className="text-sm text-muted-foreground">
          Nenhum espaço com lugar marcado. Crie um espaço para vender assentos numerados (setor com
          preço único).
        </p>
      ) : (
        <ul className="space-y-2">
          {espacos.map((espaco) => (
            <li key={espaco.id} className="rounded-lg border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{espaco.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(Number(espaco.price))} · {espaco.fileiras}×
                    {espaco.cadeiras_por_fileira} cadeiras · {espaco.livres} livre(s),{" "}
                    {espaco.reservados} reservado(s), {espaco.vendidos} vendido(s)
                  </p>
                </div>
                <Badge variant={espaco.is_active ? "secondary" : "outline"}>
                  {espaco.is_active ? "Ativo" : "Pausado"}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={espaco.is_active ? "Pausar espaço" : "Reativar espaço"}
                  onClick={() => handleToggle(espaco)}
                >
                  {espaco.is_active ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4 text-success" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={expandidoId === espaco.id ? "Ocultar mapa" : "Ver mapa de lugares"}
                  aria-expanded={expandidoId === espaco.id}
                  onClick={() => toggleMapa(espaco.id)}
                >
                  <Map className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir espaço"
                  onClick={() => setRemoverId(espaco.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>

              {expandidoId === espaco.id ? (
                <div className="mt-3 space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <SeatMapLegend />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void carregarMapa(espaco.id)}
                      disabled={mapaCarregando}
                    >
                      <RefreshCw
                        className={mapaCarregando ? "size-3.5 animate-spin" : "size-3.5"}
                      />
                      Atualizar
                    </Button>
                  </div>
                  {mapaCarregando && !mapas[espaco.id] ? (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> Carregando mapa…
                    </p>
                  ) : (
                    <SeatMap assentos={mapas[espaco.id] ?? []} readOnly />
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={!!removerId}
        onOpenChange={(o) => {
          if (!o) setRemoverId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir espaço?</AlertDialogTitle>
            <AlertDialogDescription>
              O espaço e todas as cadeiras geradas serão removidos. Espaços com lugares reservados
              ou vendidos não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemover}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
