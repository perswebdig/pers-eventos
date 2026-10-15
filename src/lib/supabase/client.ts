"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  assertSupabaseConfigured,
} from "@/lib/env";

// Singleton: evita múltiplas instâncias GoTrueClient no browser.
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  assertSupabaseConfigured();
  if (browserClient) return browserClient;
  browserClient = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return browserClient;
}
