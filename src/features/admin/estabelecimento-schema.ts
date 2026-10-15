import { z } from "zod";
import type { Estabelecimento } from "@/types/database";

export const estabelecimentoSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome (mín. 3 letras)"),
  slug: z
    .string()
    .trim()
    .min(2, "Informe um identificador")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen"),
  cnpj: z.string().trim(),
  email: z.string().trim(),
  telefone: z.string().trim(),
  endereco: z.string().trim(),
  cidade: z.string().trim(),
  estado: z.string().trim().max(2, "Use a sigla (ex.: SP)"),
  logo_url: z.string().trim(),
  ativo: z.boolean(),
});

export type EstabelecimentoFormValues = z.infer<typeof estabelecimentoSchema>;

export const estabelecimentoPatchSchema = estabelecimentoSchema.partial();

export function slugify(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const nullify = (v: string) => {
  const t = v.trim();
  return t.length ? t : null;
};

export function toEstabelecimentoRow(values: EstabelecimentoFormValues) {
  return {
    nome: values.nome.trim(),
    slug: values.slug.trim() || slugify(values.nome),
    cnpj: nullify(values.cnpj),
    email: nullify(values.email),
    telefone: nullify(values.telefone),
    endereco: nullify(values.endereco),
    cidade: nullify(values.cidade),
    estado: values.estado.toUpperCase(),
    logo_url: nullify(values.logo_url),
    ativo: values.ativo,
  };
}

export function toEstabelecimentoFormValues(
  e: Partial<Estabelecimento>,
): EstabelecimentoFormValues {
  const str = (v: string | null | undefined) => v ?? "";
  return {
    nome: str(e.nome),
    slug: str(e.slug),
    cnpj: str(e.cnpj),
    email: str(e.email),
    telefone: str(e.telefone),
    endereco: str(e.endereco),
    cidade: str(e.cidade),
    estado: str(e.estado),
    logo_url: str(e.logo_url),
    ativo: e.ativo === undefined ? true : Boolean(e.ativo),
  };
}
