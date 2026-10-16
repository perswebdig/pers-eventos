import { toast } from "sonner";
import { db } from "@/db/db";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from '@/lib/supabase/client';
import { useSyncStore } from "@/stores/sync-store";
import { runSync, type SyncResult } from "./engine";
import { createSupabaseTransport } from "./supabase-transport";

const INTERVAL_MS = 30_000;

let started = false;
let running = false;

export async function refreshPendingCount(): Promise<void> {
  const count = await db.sync_queue.count();
  useSyncStore.getState().setPendingCount(count);
}

// Executa um ciclo de sync. Silencioso quando offline.
export async function syncNow(): Promise<SyncResult | null> {
  if (!isSupabaseConfigured) return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  if (running) return null;

  running = true;
  const store = useSyncStore.getState();
  store.setSyncing(true);
  store.setError(null);
  try {
    const transport = createSupabaseTransport(createClient());
    const result = await runSync(db, transport);
    useSyncStore.getState().setResult(result);
    await refreshPendingCount();
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    useSyncStore.getState().setError(msg);
    return null;
  } finally {
    running = false;
    useSyncStore.getState().setSyncing(false);
  }
}

// Loop em background: intervalo + reconexão + volta do foco.
export function startSyncWorker(): () => void {
  if (started || typeof window === "undefined" || !isSupabaseConfigured) {
    return () => {};
  }
  started = true;

  void refreshPendingCount();

  const onOnline = async () => {
    const result = await syncNow();
    if (result) {
      toast.success("Sincronizado", {
        description: `${result.pushed} enviado(s) · ${result.pulled} recebido(s)`,
      });
    }
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") void syncNow();
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  const intervalId = window.setInterval(() => void syncNow(), INTERVAL_MS);

  void syncNow();

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(intervalId);
    started = false;
  };
}
