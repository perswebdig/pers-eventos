"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export function AssinaturaCanvas({
  value,
  onChange,
  readOnly = false,
}: {
  value: string;
  onChange: (base64: string) => void;
  readOnly?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Ajusta tamanho do canvas ao container.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";

    // Se já tem valor, desenha a imagem.
    if (value && value.startsWith("data:")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
  }, [value]);

  function getPoint(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    if (readOnly) return;
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    const { x, y } = getPoint(e);
    ctx.moveTo(x, y);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing || readOnly) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current!;
    onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const rect = canvas.parentElement!.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    onChange("");
    setClearConfirm(false);
  }

  return (
    <div className="relative border rounded-lg bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="aspect-[4/3] w-full touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      {!readOnly && (
        <div className="flex items-center justify-between p-2 border-t bg-muted/30">
          <span className="text-xs text-muted-foreground">Desenhe a assinatura acima</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearConfirm(true)}
              disabled={!value}
            >
              Limpar
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar assinatura?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={clear}>Limpar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
