import { onlyDigits } from "@/lib/format";

export interface PessoaBuscavel {
  nome_completo: string;
  cpf?: string | null;
  telefone?: string | null;
  email?: string | null;
}

export function filtrarPessoas<T extends PessoaBuscavel>(pessoas: T[], termo: string): T[] {
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
