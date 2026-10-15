"use client";

import { useEffect } from "react";
import { startSyncWorker } from "@/sync/worker";
import { setActiveTenantId } from "@/db/tenant";

// Inicia o sync worker em background enquanto a área autenticada está montada
// e registra o tenant ativo (obtido da sessão) no contexto local.
export function SyncProvider() {
  useEffect(() => {
    let cancelado = false;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { tenantId?: string | null } | null) => {
        if (!cancelado && data) setActiveTenantId(data.tenantId ?? null);
      })
      .catch(() => {});

    const stop = startSyncWorker();
    return () => {
      cancelado = true;
      stop();
    };
  }, []);

  return null;
}
