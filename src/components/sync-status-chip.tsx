"use client";

import { CheckCircle2, CloudOff, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useSyncStore } from "@/stores/sync-store";

// Indicador compacto de estado de sincronização.
export function SyncStatusChip() {
  const online = useOnlineStatus();
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const lastError = useSyncStore((s) => s.lastError);

  const {
    icon: Icon,
    label,
    tone,
  } = (() => {
    if (!online) {
      return { icon: CloudOff, label: "Offline", tone: "text-muted-foreground" };
    }
    if (isSyncing) {
      return { icon: Loader2, label: "Sincronizando…", tone: "text-blue-600" };
    }
    if (lastError) {
      return { icon: AlertTriangle, label: "Erro ao sincronizar", tone: "text-destructive" };
    }
    if (pendingCount > 0) {
      return { icon: RefreshCw, label: `${pendingCount} pendente(s)`, tone: "text-amber-600" };
    }
    return { icon: CheckCircle2, label: "Sincronizado", tone: "text-success" };
  })();

  return (
    <span
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex",
        tone,
      )}
      title={lastError ?? undefined}
      aria-live="polite"
    >
      <Icon className={cn("size-3.5", isSyncing && "animate-spin")} aria-hidden />
      {label}
    </span>
  );
}
