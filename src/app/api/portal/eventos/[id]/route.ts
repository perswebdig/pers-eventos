import { NextResponse } from "next/server";
import { apiSession, jsonError } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// GET /api/portal/eventos/:id — evento + lotes disponíveis (página de checkout).
export async function GET(_request: Request, { params }: Params) {
  const guard = await apiSession(["cliente", "tenant_admin", "staff"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { data: evento, error } = await supabase
    .from("eventos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!evento) return jsonError("Evento não encontrado.", 404);

  const { data: lotes, error: lotesError } = await supabase
    .from("ticket_types")
    .select("*")
    .eq("event_id", id)
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (lotesError) return jsonError(lotesError.message, 500);

  // Setores com lugar marcado (opcional) com contagem de lugares livres.
  // Estruturas ainda indisponíveis (migração não aplicada) não podem derrubar
  // a venda por lote: em caso de erro, seguimos apenas com lotes.
  await supabase.rpc("liberar_reservas_expiradas");

  let espacos: {
    id: string;
    nome: string;
    price: number;
    fileiras: number;
    cadeiras_por_fileira: number;
    is_active: boolean;
  }[] = [];
  const livres: Record<string, number> = {};

  const { data: espacosData, error: espacosError } = await supabase
    .from("espacos")
    .select("id, nome, price, fileiras, cadeiras_por_fileira, is_active")
    .eq("event_id", id)
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (!espacosError && espacosData) {
    espacos = espacosData;

    const espacoIds = espacos.map((e) => e.id);
    if (espacoIds.length > 0) {
      const { data: assentos } = await supabase
        .from("assentos")
        .select("espaco_id")
        .in("espaco_id", espacoIds)
        .eq("status", "livre");
      for (const assento of assentos ?? []) {
        livres[assento.espaco_id] = (livres[assento.espaco_id] ?? 0) + 1;
      }
    }
  }

  return NextResponse.json({
    data: {
      evento,
      lotes: lotes ?? [],
      espacos: espacos.map((espaco) => ({
        ...espaco,
        livres: livres[espaco.id] ?? 0,
      })),
    },
  });
}
