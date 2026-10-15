"use client";

import { useState } from "react";
import { FileText, Pen, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AssinaturaCanvas } from "./assinatura-canvas";
import { registrarAceiteTermo } from "@/db/repos/termos";
import { termoTexto, termoTipoLabel, type TermoTipo } from "./termo-schema";

interface TermoAceiteSheetProps {
  pessoaId: string;
  pessoaNome: string;
  tipo: TermoTipo;
  eventoId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TermoAceiteSheet({
  pessoaId,
  pessoaNome,
  tipo,
  eventoId,
  open,
  onOpenChange,
  onSuccess,
}: TermoAceiteSheetProps) {
  const [assinatura, setAssinatura] = useState("");
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleAceitar() {
    if (!assinatura) {
      toast.error("É necessário assinar antes de aceitar.");
      return;
    }
    if (!aceite) {
      toast.error("Marque a caixa de confirmação.");
      return;
    }
    setEnviando(true);
    try {
      await registrarAceiteTermo(
        { pessoa_id: pessoaId, evento_id: eventoId ?? undefined, tipo, assinatura_base64: assinatura },
        null, // IP será preenchido pelo servidor no sync
      );
      toast.success(`${termoTipoLabel(tipo)} aceito com sucesso!`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao registrar aceite");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <FileText className="size-5 text-primary" aria-hidden />
            </div>
            <div>
              <SheetTitle>{termoTipoLabel(tipo)}</SheetTitle>
              <SheetDescription>
                {pessoaNome} — leia atentamente antes de assinar.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4 px-4">
          <div className="h-[35vh] max-h-80 border rounded-lg p-4 bg-muted/30 overflow-y-auto">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{termoTexto[tipo]}</p>
          </div>

          <Separator />

          <div className="space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <AssinaturaCanvas value={assinatura} onChange={setAssinatura} />
            </label>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-1 size-4 rounded border-input"
              />
              <span className="text-sm">
                Li e concordo com os termos acima. A assinatura acima representa
                minha concordância livre e expressa.
              </span>
            </label>
          </div>
        </div>

        <SheetFooter className="border-t">
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              disabled={enviando || !assinatura || !aceite}
              onClick={handleAceitar}
            >
              {enviando ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Salvando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 size-4" />
                  Aceitar e assinar
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}