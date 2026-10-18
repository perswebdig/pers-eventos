import type { Evento, Inscricao, Pessoa, Ticket, TicketType } from "@/types/database";

export interface TicketDetalhe {
  ticket: Ticket;
  pessoa: Pessoa | null;
  lote: TicketType | null;
  eventoId: string | null;
  eventoNome: string | null;
}

export interface InscricaoDetalhe {
  inscricao: Inscricao;
  pessoa: Pessoa | null;
  evento: Pick<Evento, "id" | "nome" | "data_inicio"> | null;
}
