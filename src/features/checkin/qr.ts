// Formato do payload do QR de uma inscrição: "PERS1:<uuid da inscrição>".
// Mantemos um prefixo versionado para permitir evoluir o formato depois.
const PREFIX = "PERS1:";

// Formato do payload do QR de um ingresso: "PERS2:<hash de 64 hex>".
// O hash é gerado no servidor (32 bytes aleatórios) e nunca muda.
const PREFIX_INGRESSO = "PERS2:";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/i;

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

export function encodeIngressoQr(qrCodeHash: string): string {
  return `${PREFIX_INGRESSO}${qrCodeHash}`;
}

// Aceita "PERS2:<hash>" ou apenas o hash (caso alguém digite/cole o código).
export function parseIngressoQr(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (t.toUpperCase().startsWith(PREFIX_INGRESSO)) {
    const hash = t.slice(PREFIX_INGRESSO.length).trim();
    return HASH.test(hash) ? hash.toLowerCase() : null;
  }
  return HASH.test(t) ? t.toLowerCase() : null;
}
