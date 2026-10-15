import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { getSessionContext, type SessionContext } from "@/lib/auth/session";
import type { AppRole } from "@/lib/auth/roles";

export interface ApiGuardResult {
  ctx?: SessionContext;
  response?: NextResponse;
}

// Guard para Route Handlers. Valida sessão e, opcionalmente, os papéis aceitos.
export async function apiSession(
  allowed?: readonly AppRole[],
): Promise<ApiGuardResult> {
  const ctx = await getSessionContext();
  if (!ctx) {
    return {
      response: NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 },
      ),
    };
  }
  if (allowed && !allowed.includes(ctx.role)) {
    return {
      response: NextResponse.json(
        { error: "Acesso negado para o seu perfil." },
        { status: 403 },
      ),
    };
  }
  return { ctx };
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

// Valida o corpo JSON com Zod e devolve erro 422 padronizado.
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ data?: T; response?: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { response: jsonError("Corpo da requisição inválido (JSON).", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      response: NextResponse.json(
        {
          error: "Dados inválidos.",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 422 },
      ),
    };
  }
  return { data: parsed.data };
}
