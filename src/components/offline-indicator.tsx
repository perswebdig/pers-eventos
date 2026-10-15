"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";

// Banner fixo no topo, visível apenas quando offline.
// O toast de reconexão é responsabilidade do sync worker.
export function OfflineIndicator() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-amber-950"
    >
      <WifiOff className="size-3.5" aria-hidden />
      Sem conexão — você está trabalhando offline. As alterações serão
      sincronizadas automaticamente.
    </div>
  );
}
