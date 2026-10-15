import { db } from "./db";

// Contexto do tenant no cliente. O servidor é a fronteira de isolamento (RLS);
// localmente mantemos o tenant ativo apenas para carimbar dados e, sobretudo,
// para limpar o cache do dispositivo quando o usuário sai (troca de conta).
let activeTenantId: string | null | undefined;

export function setActiveTenantId(id: string | null | undefined): void {
  activeTenantId = id;
}

export function getActiveTenantId(): string | null {
  return activeTenantId ?? null;
}

// Apaga TODO o banco local. Chamado no logout para impedir que dados de um
// estabelecimento permaneçam no mesmo navegador usado por outro.
export async function wipeLocalDatabase(): Promise<void> {
  activeTenantId = undefined;
  await db.delete();
  await db.open();
}
