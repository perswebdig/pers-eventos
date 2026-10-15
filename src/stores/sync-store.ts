import { create } from "zustand";
import type { SyncResult } from "@/sync/engine";

interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastResult: SyncResult | null;
  lastError: string | null;
  setSyncing: (v: boolean) => void;
  setPendingCount: (v: number) => void;
  setResult: (r: SyncResult) => void;
  setError: (e: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastResult: null,
  lastError: null,
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setResult: (lastResult) =>
    set({ lastResult, lastSyncAt: new Date().toISOString(), lastError: null }),
  setError: (lastError) => set({ lastError }),
}));
