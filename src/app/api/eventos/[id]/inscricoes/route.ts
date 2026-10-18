import { NextResponse } from "next/server";
import { apiSession, jsonError, parseBody } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";
import { inscricaoFormSchema } from "@/features/eventos/evento-schema";

type Params = { params: Promise<{ id: string }> };

// POST /api/eventos/:id/inscricoes — inscreve uma pessoa no evento.
export async function POST(request: Request, { params }: Params) {
  const guard = await apiSession(["tenant_admin", "staff"]);
  if (guard.response) return guard.response;
  const { id } = await params;

  const { data, response } = await parseBody(request, inscricaoFormSchema);
  if (response) return response;
  const values = data!;

  const supabase = await createClient();

  const { data: evento } = await supabase.from("eventos").select("id").eq("id", id).maybeSingle();
  if (!evento) return jsonError("Evento não encontrado.", 404);

  const { data: existente } = await supabase
    .from("inscricoes")
    .select("id")
    .eq("evento_id", id)
    .eq("pessoa_id", values.pessoa_id)
    .maybeSingle();

  if (existente) return jsonError("Esta pessoa já está inscrita neste evento.", 409);

  const valor = values.valor.trim() ? Number(values.valor.replace(",", ".")) : null;

  const { data: created, error } = await supabase
    .from("inscricoes")
    .insert({
      evento_id: id,
      pessoa_id: values.pessoa_id,
      status: values.status,
      pagamento_status: values.pagamento_status,
      valor: Number.isFinite(valor) ? valor : null,
      forma_pagamento: values.forma_pagamento.trim() || null,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return NextResponse.json({ data: created }, { status: 201 });
}
