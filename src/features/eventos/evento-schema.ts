import { z } from "zod";

export const EVENTO_STATUS = [
  { value: "planejado", label: "Planejado" },
  { value: "aberto", label: "Aberto" },
  { value: "lotado", label: "Lotado" },
  { value: "realizado", label: "Realizado" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export type EventoStatus = (typeof EVENTO_STATUS)[number]["value"];

export const eventoStatusLabel = (value: string): string =>
  EVENTO_STATUS.find((s) => s.value === value)?.label ?? value;

// Campos de texto são sempre strings (o formulário garante todas as chaves);
// sem `optional`/`default` para manter entrada e saída do Zod idênticas.
const optionalText = z.string().trim();

const ehDataValida = (v: string) => v.length > 0 && !Number.isNaN(Date.parse(v));

export const eventoBaseSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome do evento (mín. 3 letras)"),
  descricao: optionalText,
  data_inicio: z
    .string()
    .trim()
    .min(1, "Informe a data de início")
    .refine(ehDataValida, "Data inválida"),
  data_fim: optionalText,
  local: optionalText,
  capacidade: optionalText,
  status: z.enum(["planejado", "aberto", "lotado", "realizado", "cancelado"]),
});

// Usado em PATCH: todos os campos opcionais (sem refinamento cruzado).
export const eventoPatchSchema = eventoBaseSchema.partial();

export const eventoFormSchema = eventoBaseSchema.superRefine((data, ctx) => {
  if (data.data_fim) {
    if (!ehDataValida(data.data_fim)) {
      ctx.addIssue({ code: "custom", path: ["data_fim"], message: "Data inválida" });
    } else if (data.data_fim < data.data_inicio) {
      ctx.addIssue({
        code: "custom",
        path: ["data_fim"],
        message: "Término não pode ser antes do início",
      });
    }
  }

  if (data.capacidade) {
    const n = Number(data.capacidade);
    if (!Number.isInteger(n) || n < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["capacidade"],
        message: "Informe um número inteiro de vagas",
      });
    }
  }
});

export type EventoFormValues = z.infer<typeof eventoFormSchema>;

interface EventoLike {
  nome?: string | null;
  descricao?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  local?: string | null;
  capacidade?: number | null;
  status?: string | null;
}

export function toEventoFormValues(evento: EventoLike): EventoFormValues {
  const str = (v: string | number | null | undefined) =>
    v === null || v === undefined ? "" : String(v);
  return {
    nome: str(evento.nome),
    descricao: str(evento.descricao),
    data_inicio: str(evento.data_inicio).slice(0, 10),
    data_fim: str(evento.data_fim).slice(0, 10),
    local: str(evento.local),
    capacidade: str(evento.capacidade),
    status: (str(evento.status) || "planejado") as EventoStatus,
  };
}

// Converte o formulário para a linha do banco (strings vazias -> null).
export function toEventoRow(values: EventoFormValues) {
  const nullify = (v: string) => {
    const t = v.trim();
    return t.length ? t : null;
  };
  const cap = values.capacidade.trim();
  return {
    nome: values.nome.trim(),
    descricao: nullify(values.descricao),
    data_inicio: values.data_inicio,
    data_fim: nullify(values.data_fim),
    local: nullify(values.local),
    capacidade: cap ? Math.trunc(Number(cap)) : null,
    status: values.status,
  };
}

// ---------------------------------------------------------------------------
// Inscrições
// ---------------------------------------------------------------------------
export const INSCRICAO_STATUS = [
  { value: "inscrito", label: "Inscrito" },
  { value: "confirmado", label: "Confirmado" },
  { value: "checkin", label: "Check-in" },
  { value: "checkout", label: "Check-out" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export const inscricaoStatusLabel = (value: string): string =>
  INSCRICAO_STATUS.find((s) => s.value === value)?.label ?? value;

export const PAGAMENTO_STATUS = [
  { value: "pendente", label: "Pendente" },
  { value: "pago", label: "Pago" },
  { value: "isento", label: "Isento" },
  { value: "reembolsado", label: "Reembolsado" },
] as const;

export const pagamentoStatusLabel = (value: string): string =>
  PAGAMENTO_STATUS.find((s) => s.value === value)?.label ?? value;

export const inscricaoFormSchema = z.object({
  pessoa_id: z.string().trim().min(1, "Selecione uma pessoa"),
  status: z.enum(["inscrito", "confirmado", "checkin", "checkout", "cancelado"]),
  pagamento_status: z.enum(["pendente", "pago", "isento", "reembolsado"]),
  valor: optionalText,
  forma_pagamento: optionalText,
});

export type InscricaoFormValues = z.infer<typeof inscricaoFormSchema>;
