import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { EntidadeSync } from "@/db/types";
import type { SyncTransport } from "./engine";

type Row = Record<string, unknown>;
type Client = SupabaseClient<Database>;

// Acesso às tabelas dinamicamente: o nome vem de `EntidadeSync`, variável e
// portanto sem tipagem estática. O RLS do Postgres é a garantia de segurança.
function from(client: Client, entidade: EntidadeSync) {
  return client.from(entidade) as unknown as {
    upsert: (v: Row) => {
      select: () => { single: () => Promise<{ data: Row | null; error: unknown }> };
    };
    update: (v: Row) => {
      eq: (
        c: string,
        v: string,
      ) => {
        select: () => { single: () => Promise<{ data: Row | null; error: unknown }> };
      };
    };
    delete: () => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
    select: (c: string) => {
      order: (
        c: string,
        o: { ascending: boolean },
      ) => {
        limit: (n: number) => {
          gt: (c: string, v: string) => Promise<{ data: Row[] | null; error: unknown }>;
        } & Promise<{ data: Row[] | null; error: unknown }>;
      };
    };
  };
}

export function createSupabaseTransport(client: Client): SyncTransport {
  return {
    async upsert(entidade, row) {
      const { data, error } = await from(client, entidade).upsert(row).select().single();
      if (error) throw error;
      return data;
    },
    async update(entidade, id, row) {
      const { data, error } = await from(client, entidade)
        .update(row)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async remove(entidade, id) {
      const { error } = await from(client, entidade).delete().eq("id", id);
      if (error) throw error;
    },
    async fetchSince(entidade, since, limit) {
      const base = from(client, entidade)
        .select("*")
        .order("updated_at", { ascending: true })
        .limit(limit);
      if (since) {
        const { data, error } = await base.gt("updated_at", since);
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await base;
      if (error) throw error;
      return data ?? [];
    },
  };
}
