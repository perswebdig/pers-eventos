"use client";

import { useEffect, useRef } from "react";

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

// O leitor usa a API nativa `BarcodeDetector` (Chromium).
export function isQrScanSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "BarcodeDetector" in window &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export function QrScanner({
  active,
  onScan,
  onError,
}: {
  active: boolean;
  onScan: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  onScanRef.current = onScan;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let detector: BarcodeDetectorLike | null = null;

    async function start() {
      if (!isQrScanSupported()) {
        onErrorRef.current?.("Leitor de QR não suportado neste navegador. Use a busca manual.");
        return;
      }
      const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        onErrorRef.current?.(
          "Não foi possível acessar a câmera. Verifique as permissões do navegador.",
        );
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});

      detector = new Ctor({ formats: ["qr_code"] });

      const tick = async () => {
        if (cancelled || !video || !detector) return;
        try {
          const codes = await detector.detect(video);
          const raw = codes[0]?.rawValue;
          if (raw) {
            onScanRef.current(raw);
            return;
          }
        } catch {
          // ignora frames ilegíveis e tenta de novo
        }
        timer = window.setTimeout(tick, 300);
      };
      timer = window.setTimeout(tick, 400);
    }

    void start();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [active]);

  return (
    <div className="relative overflow-hidden rounded-lg border bg-black">
      <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="size-44 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
    </div>
  );
}
