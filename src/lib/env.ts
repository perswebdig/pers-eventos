// Variáveis de ambiente públicas do Supabase.
// Aceita tanto as chaves novas (publishable) quanto as legadas (anon).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

// Flag usada para evitar criar clientes Supabase inválidos (ex.: build sem env).
export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local.",
    );
  }
}
