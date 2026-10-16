"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { QRCodeSVG } from "qrcode.react";
import { parseInscricaoQr, encodeInscricaoQr } from "./qr";

export function QRGenerator() {
  const [qrInscId, setQrInscId] = useState("");

  return (
    <Card>
      <CardContent className="pt-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Gerar QR de uma inscrição
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Informe o ID da inscrição para visualizar/baixar o QR code.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Cole o UUID da inscrição"
            onChange={(e) => {
              const id = e.target.value.trim();
              if (id && parseInscricaoQr(`PERS1:${id}`)) {
                setQrInscId(id);
              }
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              // estado já atualizado via onChange
            }}
          >
            Gerar
          </Button>
        </div>
        {qrInscId && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="bg-white p-4 rounded-lg shadow">
              <QRCodeSVG value={encodeInscricaoQr(qrInscId)} size={180} />
            </div>
            <div className="flex gap-2">
              <p className="text-xs text-muted-foreground font-mono flex-1 truncate">
                {encodeInscricaoQr(qrInscId)}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const canvas = document.querySelector("canvas");
                  if (canvas) {
                    const link = document.createElement("a");
                    link.download = `qr-${qrInscId}.png`;
                    link.href = canvas.toDataURL("image/png");
                    link.click();
                  }
                }}
              >
                Baixar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setQrInscId("")}>
                <X className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FALHOU: ${msg}`);
  console.log(`OK  ${msg}`);
}

function pessoa(nome: string) {
  const ts = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    nome_completo: nome,
    cpf: null,
    rg: null,
    data_nascimento: null,
    telefone: null,
    email: null,
    endereco: null,
    contato_emergencia_nome: null,
    contato_emergencia_telefone: null,
    restricoes_alimentares: null,
    condicoes_saude: null,
    medicacoes: null,
    observacoes: null,
    consentimento_lgpd: true,
    created_at: ts,
    updated_at: ts,
    sync_status: "synced" as const,
  };
}
