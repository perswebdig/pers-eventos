import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/api";

// Resumo da sessão (papel + tenant) para o cliente inicializar o contexto local.
export async function GET() {
  const guard = await apiSession();
  if (guard.response) return guard.response;
  const ctx = guard.ctx!;

  return NextResponse.json({
    userId: ctx.userId,
    email: ctx.email,
    nome: ctx.nome,
    role: ctx.role,
    papel: ctx.papel,
    tenantId: ctx.tenantId,
    pessoaId: ctx.pessoaId,
    estabelecimento: ctx.estabelecimento,
  });
}
