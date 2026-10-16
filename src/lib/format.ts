import { onlyDigits } from "./cpf";

export { onlyDigits, formatCpf, isValidCpf } from "./cpf";

export function formatTelefone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

export function calcularIdade(dataNascimento: string | null | undefined): number | null {
  if (!dataNascimento) return null;
  const nasc = new Date(
    dataNascimento.length <= 10 ? `${dataNascimento}T00:00:00` : dataNascimento,
  );
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

export function ehMenor(dataNascimento: string | null | undefined): boolean {
  const idade = calcularIdade(dataNascimento);
  return idade !== null && idade < 18;
}

// Data de hoje no formato aceito por <input type="date">.
export function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}
