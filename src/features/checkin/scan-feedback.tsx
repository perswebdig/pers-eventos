"use client";

import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "cn";

export type ScanFeedbackKind = "ok" | "warn" | "error";

export interface ScanFeedbackData {
  kind: ScanFeedbackKind;
  title: string;
  subtitle?: string;
}

const STYLES: Record<
  ScanFeedbackKind,
  { container: string; icon: React.ComponentType<{ className?: string }> }
> = {
  ok: { container: "bg-success text-success-foreground", icon: CheckCircle2 },
  warn: { container: "bg-warning text-warning-foreground", icon: AlertTriangle },
  error: { container: "bg-destructive text-white", icon: XCircle },
};

export function playScanBeep(kind: ScanFeedbackKind) {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = kind === "ok" ? 880 : kind === "warn" ? 520 : 220;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    osc.onended = () => void ctx.close();
  } catch {
    // som é opcional — ignoramos falhas de autoplay/contexto
  }
}

export function vibrateScan(kind: ScanFeedbackKind) {
  try {
    navigator.vibrate?.(kind === "ok" ? [60] : kind === "warn" ? [120, 60, 120] : [200, 80, 200]);
  } catch {
    // vibração é opcional
  }
}

export function ScanFeedback({
  feedback,
  onDone,
}: {
  feedback: ScanFeedbackData | null;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(onDone, feedback.kind === "ok" ? 1800 : 2400);
    return () => clearTimeout(timeout);
  }, [feedback, onDone]);

  if (!feedback) return null;

  const { container, icon: Icon } = STYLES[feedback.kind];

  return (
    <button
      type="button"
      role="status"
      aria-live="assertive"
      onClick={onDone}
      className={cn(
        "fixed inset-0 z-50 flex w-full cursor-pointer flex-col items-center justify-center gap-4 p-6 text-center backdrop-blur-sm",
        container,
      )}
    >
      <Icon className="size-24" />
      <span className="text-3xl font-bold tracking-tight">{feedback.title}</span>
      {feedback.subtitle ? (
        <span className="max-w-md text-lg opacity-90">{feedback.subtitle}</span>
      ) : null}
      <span className="text-xs opacity-60">toque para fechar</span>
    </button>
  );
}
