import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SUPABASE_URL } from "@/lib/env";
import {
  SUPABASE_SECRET_KEY,
  assertSupabaseAdminConfigured,
} from "@/lib/env.server";

// Cliente administrativo (service role). Ignora RLS — use SOMENTE no servidor,
// em rotas protegidas por verificação de papel, para criar/gerir usuários.
export function createAdminClient() {
  assertSupabaseAdminConfigured();
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
