import { db } from "@/db/db";
import { deleteLocal, saveLocal } from "@/db/queue";
import type { EventoLocal, InscricaoLocal, MenorLocal, PessoaLocal } from "@/db/types";
import type { PessoaFormValues } from "@/features/pessoas/pessoa-schema";
import { onlyDigits } from "@/lib/format";
import { ehMenor, todayInput } from "@/lib/format";

const nullify = (v: string) => {
  const t = v.trim();
  return t.length ? t : null;
};

export async function listPessoas(): Promise<PessoaLocal[]> {
  return db.pessoas.orderBy("nome_completo").toArray();
}

export interface PessoaDetalhe {
  pessoa: PessoaLocal;
  menor: MenorLocal | null;
  historico: Array<{ inscricao: InscricaoLocal; evento: EventoLocal | null }>;
}

export async function getPessoaDetalhe(id: string): Promise<PessoaDetalhe | null> {
  const pessoa = await db.pessoas.get(id);
  if (!pessoa) return null;

  const menor = (await db.menores.where("pessoa_id").equals(id).first()) ?? null;
  const inscricoes = await db.inscricoes.where("pessoa_id").equals(id).toArray();
  const eventos = await db.eventos.bulkGet(inscricoes.map((i) => i.evento_id));
  const historico = inscricoes.map((inscricao, i) => ({
    inscricao,
    evento: eventos[i] ?? null,
  }));

  return { pessoa, menor, historico };
}

export async function savePessoa(values: PessoaFormValues, id?: string): Promise<string> {
  const existente = id ? await db.pessoas.get(id) : undefined;
  const pessoaId = existente?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();

  const pessoa: PessoaLocal = {
    id: pessoaId,
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
    created_at: existente?.created_at ?? now,
    updated_at: now,
    sync_status: "pending",
  };

  await saveLocal(db, "pessoas", pessoa);
  await sincronizarMenor(pessoaId, values, now);
  return pessoaId;
}

async function sincronizarMenor(
  pessoaId: string,
  values: PessoaFormValues,
  now: string,
): Promise<void> {
  const existente = await db.menores.where("pessoa_id").equals(pessoaId).first();

  if (ehMenor(values.data_nascimento)) {
    const menor: MenorLocal = {
      id: existente?.id ?? crypto.randomUUID(),
      pessoa_id: pessoaId,
      responsavel_nome: values.responsavel_nome.trim(),
      responsavel_cpf: onlyDigits(values.responsavel_cpf),
      autorizacao_url: existente?.autorizacao_url ?? null,
      created_at: existente?.created_at ?? now,
      updated_at: now,
      sync_status: "pending",
    };
    await saveLocal(db, "menores", menor);
  } else if (existente) {
    await deleteLocal(db, "menores", existente.id);
  }
}

export async function deletePessoa(id: string): Promise<void> {
  // No servidor a exclusão em cascata remove os dependentes; localmente
  // removemos junto para a UI não exibir órfãos.
  await db.transaction(
    "rw",
    [db.menores, db.documentos, db.termos, db.inscricoes, db.arquivos],
    async () => {
      await db.menores.where("pessoa_id").equals(id).delete();
      await db.documentos.where("pessoa_id").equals(id).delete();
      await db.termos.where("pessoa_id").equals(id).delete();
      await db.inscricoes.where("pessoa_id").equals(id).delete();
      await db.arquivos.where("pessoa_id").equals(id).delete();
    },
  );
  await deleteLocal(db, "pessoas", id);
}

// Busca local por nome, CPF ou telefone (IndexedDB, sem rede).
export function filtrarPessoas<
  T extends {
    nome_completo: string;
    cpf?: string | null;
    telefone?: string | null;
    email?: string | null;
  },
>(pessoas: T[], termo: string): T[] {
  const t = termo.trim().toLowerCase();
  if (!t) return pessoas;
  const numeros = onlyDigits(t);
  return pessoas.filter((p) => {
    if (p.nome_completo.toLowerCase().includes(t)) return true;
    if (numeros.length >= 3) {
      if (p.cpf?.includes(numeros)) return true;
      if (p.telefone?.includes(numeros)) return true;
    }
    if (p.email?.toLowerCase().includes(t)) return true;
    return false;
  });
}

export { todayInput };
