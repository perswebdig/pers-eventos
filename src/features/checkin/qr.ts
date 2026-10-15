// Formato do payload do QR de uma inscrição: "PERS1:<uuid da inscrição>".
// Mantemos um prefixo versionado para permitir evoluir o formato depois.
const PREFIX = "PERS1:";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeInscricaoQr(inscricaoId: string): string {
  return `${PREFIX}${inscricaoId}`;
}

// Aceita o payload com prefixo ou apenas o uuid (caso alguém digite o código).
export function parseInscricaoQr(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (t.toUpperCase().startsWith(PREFIX)) {
    const id = t.slice(PREFIX.length).trim();
    return UUID.test(id) ? id : null;
  }
  return UUID.test(t) ? t : null;
}
