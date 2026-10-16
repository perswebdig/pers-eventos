import { z } from "zod";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { ehMenor } from "@/lib/format";
import type { Pessoa } from "@/types/database";

// Campos de texto são sempre strings (podem ser vazias); o formulário garante
// que todas as chaves existam, então não usamos `optional`/`default` — isso
// mantém os tipos de entrada e saída do Zod idênticos (exigência do resolver).
const optionalText = z.string().trim();

// Schema base sem refinamentos (para uso com .partial())
const pessoaBaseSchema = z.object({
  nome_completo: z.string().trim().min(3, "Informe o nome completo (mín. 3 letras)"),
  cpf: optionalText,
  rg: optionalText,
  data_nascimento: optionalText,
  telefone: optionalText,
  email: optionalText,
  endereco: optionalText,
  contato_emergencia_nome: optionalText,
  contato_emergencia_telefone: optionalText,
  restricoes_alimentares: optionalText,
  condicoes_saude: optionalText,
  medicacoes: optionalText,
  observacoes: optionalText,
  consentimento_lgpd: z.boolean(),
  responsavel_nome: optionalText,
  responsavel_cpf: optionalText,
});

// Schema completo com refinamentos (para criação)
export const pessoaSchema = pessoaBaseSchema.superRefine((data, ctx) => {
  if (data.cpf && !isValidCpf(data.cpf)) {
    ctx.addIssue({ code: "custom", path: ["cpf"], message: "CPF inválido" });
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    ctx.addIssue({ code: "custom", path: ["email"], message: "E-mail inválido" });
  }

  if (!data.consentimento_lgpd) {
    ctx.addIssue({
      code: "custom",
      path: ["consentimento_lgpd"],
      message: "É necessário registrar o consentimento LGPD",
    });
  }

  // Campos obrigatórios condicionais para menores de 18 anos.
  if (ehMenor(data.data_nascimento)) {
    if (!data.responsavel_nome || data.responsavel_nome.length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["responsavel_nome"],
        message: "Informe o nome do responsável",
      });
    }
    if (!data.responsavel_cpf || !isValidCpf(data.responsavel_cpf)) {
      ctx.addIssue({
        code: "custom",
        path: ["responsavel_cpf"],
        message: "CPF do responsável inválido",
      });
    }
  }
});

// Schema parcial para PATCH (atualização parcial) - sem refinamentos cruzados
export const pessoaPatchSchema = pessoaBaseSchema.partial();

export type PessoaFormValues = z.infer<typeof pessoaSchema>;

export function toPessoaFormValues(pessoa: Partial<Pessoa>): PessoaFormValues {
  const str = (v: string | null | undefined) => v ?? "";
  return {
    nome_completo: str(pessoa.nome_completo),
    cpf: str(pessoa.cpf),
    rg: str(pessoa.rg),
    data_nascimento: str(pessoa.data_nascimento),
    telefone: str(pessoa.telefone),
    email: str(pessoa.email),
    endereco: str(pessoa.endereco),
    contato_emergencia_nome: str(pessoa.contato_emergencia_nome),
    contato_emergencia_telefone: str(pessoa.contato_emergencia_telefone),
    restricoes_alimentares: str(pessoa.restricoes_alimentares),
    condicoes_saude: str(pessoa.condicoes_saude),
    medicacoes: str(pessoa.medicacoes),
    observacoes: str(pessoa.observacoes),
    consentimento_lgpd: Boolean(pessoa.consentimento_lgpd),
    responsavel_nome: str(
      (pessoa as Record<string, unknown>)["responsavel_nome"] as string | null | undefined,
    ),
    responsavel_cpf: str(
      (pessoa as Record<string, unknown>)["responsavel_cpf"] as string | null | undefined,
    ),
  };
}

export function cpfDigits(value: string): string {
  return onlyDigits(value);
}

const nullify = (v: string) => {
  const t = v.trim();
  return t.length ? t : null;
};

// Converte o formulário completo para a linha do banco (usado em POST).
export function toPessoaRow(values: PessoaFormValues) {
  return {
    nome_completo: values.nome_completo.trim(),
    cpf: values.cpf ? onlyDigits(values.cpf) : null,
    rg: nullify(values.rg),
    data_nascimento: nullify(values.data_nascimento),
    telefone: values.telefone ? onlyDigits(values.telefone) : null,
    email: nullify(values.email),
    endereco: nullify(values.endereco),
    contato_emergencia_nome: nullify(values.contato_emergencia_nome),
    contato_emergencia_telefone: values.contato_emergencia_telefone
      ? onlyDigits(values.contato_emergencia_telefone)
      : null,
    restricoes_alimentares: nullify(values.restricoes_alimentares),
    condicoes_saude: nullify(values.condicoes_saude),
    medicacoes: nullify(values.medicacoes),
    observacoes: nullify(values.observacoes),
    consentimento_lgpd: values.consentimento_lgpd,
  };
}

// Converte dados parciais para PATCH (apenas campos enviados).
export function toPessoaPatchRow(values: Partial<PessoaFormValues>) {
  const patch: Record<string, unknown> = {};
  if (values.nome_completo !== undefined) patch.nome_completo = values.nome_completo.trim();
  if (values.cpf !== undefined) patch.cpf = values.cpf ? onlyDigits(values.cpf) : null;
  if (values.rg !== undefined) patch.rg = nullify(values.rg);
  if (values.data_nascimento !== undefined) patch.data_nascimento = nullify(values.data_nascimento);
  if (values.telefone !== undefined)
    patch.telefone = values.telefone ? onlyDigits(values.telefone) : null;
  if (values.email !== undefined) patch.email = nullify(values.email);
  if (values.endereco !== undefined) patch.endereco = nullify(values.endereco);
  if (values.contato_emergencia_nome !== undefined)
    patch.contato_emergencia_nome = nullify(values.contato_emergencia_nome);
  if (values.contato_emergencia_telefone !== undefined)
    patch.contato_emergencia_telefone = values.contato_emergencia_telefone
      ? onlyDigits(values.contato_emergencia_telefone)
      : null;
  if (values.restricoes_alimentares !== undefined)
    patch.restricoes_alimentares = nullify(values.restricoes_alimentares);
  if (values.condicoes_saude !== undefined) patch.condicoes_saude = nullify(values.condicoes_saude);
  if (values.medicacoes !== undefined) patch.medicacoes = nullify(values.medicacoes);
  if (values.observacoes !== undefined) patch.observacoes = nullify(values.observacoes);
  if (values.consentimento_lgpd !== undefined) patch.consentimento_lgpd = values.consentimento_lgpd;
  return patch;
}

// Dados do responsável exigidos para menores (tabela `menores`).
export function toMenorRow(values: PessoaFormValues, pessoaId: string) {
  return {
    pessoa_id: pessoaId,
    responsavel_nome: values.responsavel_nome.trim(),
    responsavel_cpf: onlyDigits(values.responsavel_cpf),
  };
}
