import { z } from "zod";
import { parseValor } from "@/features/ingressos/lote-schema";

const preco = z
  .custom<unknown>((v) => v !== undefined && v !== null, { message: "Informe o preço." })
  .transform((v, ctx) => {
    const n = parseValor(v);
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      ctx.addIssue({ code: "custom", message: "Preço inválido (use ex.: 50,00)." });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

function inteiroCampo(min: number, max: number, mensagem: string) {
  return z
    .custom<unknown>((v) => v !== undefined && v !== null, { message: "Informe um valor." })
    .transform((v, ctx) => {
      const n = typeof v === "number" ? v : Number(String(v).trim());
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: mensagem });
        return z.NEVER;
      }
      return n;
    });
}

export const espacoFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome do espaço (ex.: Setor A).")
    .max(80, "Máximo de 80 caracteres."),
  price: preco,
  fileiras: inteiroCampo(1, 26, "Fileiras: inteiro de 1 a 26 (A–Z)."),
  cadeiras_por_fileira: inteiroCampo(1, 200, "Cadeiras por fileira: inteiro de 1 a 200."),
});

export type EspacoFormValues = z.input<typeof espacoFormSchema>;
export type EspacoFormParsed = z.output<typeof espacoFormSchema>;
