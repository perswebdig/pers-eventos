import { z } from "zod";

// Converte "50", "50,00", "R$ 50,00" em número. Campos vazios viram NaN para
// que as mensagens de validação apareçam no formulário.
export function parseValor(input: unknown): number {
  if (typeof input === "number") return input;
  if (typeof input !== "string") return Number.NaN;
  const limpo = input
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!limpo) return Number.NaN;
  return Number(limpo);
}

const valorMonetario = z
  .custom<unknown>((v) => v !== undefined && v !== null, { message: "Informe o preço." })
  .transform((v, ctx) => {
    const n = parseValor(v);
    if (!Number.isFinite(n) || n < 0 || n > 100000) {
      ctx.addIssue({ code: "custom", message: "Preço inválido (use ex.: 50,00)." });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

const quantidade = z
  .custom<unknown>((v) => v !== undefined && v !== null, { message: "Informe a quantidade." })
  .transform((v, ctx) => {
    const n = typeof v === "number" ? v : Number(String(v).trim());
    if (!Number.isInteger(n) || n < 1 || n > 100000) {
      ctx.addIssue({
        code: "custom",
        message: "Quantidade deve ser um inteiro entre 1 e 100.000.",
      });
      return z.NEVER;
    }
    return n;
  });

export const loteFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome do lote (ex.: 1º Lote).")
    .max(80, "Máximo de 80 caracteres."),
  price: valorMonetario,
  quantity_total: quantidade,
  is_active: z.boolean(),
});

export type LoteFormValues = z.input<typeof loteFormSchema>;
export type LoteFormParsed = z.output<typeof loteFormSchema>;
