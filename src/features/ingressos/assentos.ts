import type { Assento } from "@/types/database";

export type AssentoMapa = Pick<Assento, "id" | "fileira" | "numero" | "status">;

export interface FileiraAssentos {
  fileira: string;
  assentos: AssentoMapa[];
}

// Agrupa os assentos por fileira, ordenando fileiras (A–Z) e números.
export function agruparPorFileira(assentos: AssentoMapa[]): FileiraAssentos[] {
  const mapa = new Map<string, AssentoMapa[]>();
  for (const assento of assentos) {
    const lista = mapa.get(assento.fileira) ?? [];
    lista.push(assento);
    mapa.set(assento.fileira, lista);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fileira, lista]) => ({
      fileira,
      assentos: [...lista].sort((a, b) => a.numero - b.numero),
    }));
}

export function rotuloAssento(fileira: string, numero: number): string {
  return `${fileira}${numero}`;
}
