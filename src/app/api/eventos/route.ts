import { NextResponse } from "next/server";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from '@/lib/supabase/server';
import {
  eventoFormSchema,
  toEventoRow,
} from "@/features/eventos/evento-schema";

// GET /api/eventos — lista os eventos do estabelecimento (RLS por tenant).
export async function GET() {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .order("data_inicio", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ data: data ?? [] });
}

// POST /api/eventos — cria evento no tenant do usuário (Admin do Estabelecimento).
export async function POST(request: Request) {
  const guard = await apiSession(["tenant_admin"]);
  if (guard.response) return guard.response;

  const { data, response } = await parseBody(request, eventoFormSchema);
  if (response) return response;

  const supabase = await createClient();
  // tenant_id é carimbado pelo trigger set_tenant_id a partir do perfil.
  const { data: created, error } = await supabase
    .from("eventos")
    .insert(toEventoRow(data!))
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: created }, { status: 201 });
}
