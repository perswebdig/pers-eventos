// Variáveis de ambiente exclusivas do servidor (NUNCA importar no client).
import { SUPABASE_URL } from "@/lib/env";

// Chave secreta (service role). Em projetos novos do Supabase é a "secret key";
// em projetos legados é a SERVICE_ROLE_KEY. Habilita o Admin API (criar usuários).
export const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isSupabaseAdminConfigured = SUPABASE_URL.length > 0 && SUPABASE_SECRET_KEY.length > 0;

export function assertSupabaseAdminConfigured(): void {
  if (!isSupabaseAdminConfigured) {
    throw new Error(
      "Supabase Admin não configurado. Defina SUPABASE_SECRET_KEY (service role) em .env.local.",
    );
  }
}
