import { z } from "zod";
import { onlyDigits } from "@/lib/cpf";

// Interpreta o campo único "CPF ou e-mail" da busca de vínculo.
export function interpretarBusca(texto: string): { cpf: string } | { email: string } | null {
  const t = texto.trim();
  if (!t) return null;

  if (t.includes("@")) {
    return { email: t.toLowerCase() };
  }

  const digitos = onlyDigits(t);
  if (digitos.length === 11) return { cpf: digitos };
  return null;
}

// Payload do POST /api/tenant/pessoas/vincular (servidor).
export const vincularPessoaSchema = z
  .object({
    cpf: z.string().trim().nullish(),
    email: z.string().trim().nullish(),
  })
  .superRefine((data, ctx) => {
    const cpf = data.cpf ? onlyDigits(data.cpf) : "";
    const email = data.email ?? "";

    if (!cpf && !email) {
      ctx.addIssue({ code: "custom", path: ["cpf"], message: "Informe o CPF ou o e-mail." });
      return;
    }
    if (cpf && cpf.length !== 11) {
      ctx.addIssue({ code: "custom", path: ["cpf"], message: "CPF deve ter 11 dígitos." });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "E-mail inválido." });
    }
  });

export type VincularPessoaValues = z.infer<typeof vincularPessoaSchema>;
