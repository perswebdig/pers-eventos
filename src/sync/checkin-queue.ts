import { db } from "@/db/db";

export interface FlushCheckinResult {
  enviados: number;
  jaFeitos: number;
  naoEncontrados: number;
}

// Envia a fila local de check-ins de ingressos para o servidor
// (POST /api/tenant/check-in/sync). Idempotente: o servidor ignora hashes já
// processados. Retorna null quando offline/falha de rede (a fila é mantida).
export async function flushCheckinQueue(): Promise<FlushCheckinResult | null> {
  if (typeof fetch !== "function") return null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;

  const itens = await db.checkin_queue.orderBy("created_at").toArray();
  if (itens.length === 0) return { enviados: 0, jaFeitos: 0, naoEncontrados: 0 };

  let res: Response;
  try {
    res = await fetch("/api/tenant/check-in/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkins: itens.map((item) => ({
          qr_code_hash: item.qr_code_hash,
          checked_in_at: item.checked_in_at,
        })),
      }),
    });
  } catch {
    return null; // rede caiu: tenta no próximo ciclo
  }

  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as
    | { data?: { processed?: number; already?: number; not_found?: string[] } }
    | null;

  // Sucesso: limpa a fila enviada e marca os ingressos como sincronizados.
  for (const item of itens) {
    await db.tickets.update(item.ticket_id, { sync_status: "synced" });
    if (typeof item.id === "number") await db.checkin_queue.delete(item.id);
  }

  return {
    enviados: body?.data?.processed ?? itens.length,
    jaFeitos: body?.data?.already ?? 0,
    naoEncontrados: body?.data?.not_found?.length ?? 0,
  };
}
