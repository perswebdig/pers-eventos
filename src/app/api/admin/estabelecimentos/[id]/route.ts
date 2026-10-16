import { NextResponse } from "next/server";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from '@/lib/supabase/server';
import {
  estabelecimentoPatchSchema,
  toEstabelecimentoRow,
} from "@/features/admin/estabelecimento-schema";
import type { Estabelecimento } from "@/types/database";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/estabelecimentos/:id — detalhe do tenant.
export async function GET(_request: Request, { params }: Params) {
  const guard = await apiSession(["super_admin"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estabelecimentos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Estabelecimento não encontrado.", 404);
  return NextResponse.json({ data });
}

// PATCH /api/admin/estabelecimentos/:id — atualiza o tenant.
export async function PATCH(request: Request, { params }: Params) {
  const guard = await apiSession(["super_admin"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const { data, response } = await parseBody(request, estabelecimentoPatchSchema);
  if (response) return response;

  const patch = toEstabelecimentoRow({
    nome: data!.nome ?? "",
    slug: data!.slug ?? "",
    cnpj: data!.cnpj ?? "",
    email: data!.email ?? "",
    telefone: data!.telefone ?? "",
    endereco: data!.endereco ?? "",
    cidade: data!.cidade ?? "",
    estado: data!.estado ?? "",
    logo_url: data!.logo_url ?? "",
    ativo: data!.ativo ?? true,
  });
  // Remove campos não enviados para não sobrescrever com valores vazios.
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([k]) => k in (data as object)),
  ) as unknown as Partial<Estabelecimento>;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("estabelecimentos")
    .update(clean)
    .eq("id", id)
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: updated });
}

// DELETE /api/admin/estabelecimentos/:id — remove o tenant (cascata nos dados).
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await apiSession(["super_admin"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const supabase = await createClient();
  const { error } = await supabase.from("estabelecimentos").delete().eq("id", id);
  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ ok: true });
}
