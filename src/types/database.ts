// Tipos do banco. Em produção, regenere com:
//   supabase gen types typescript --project-id <id> > src/types/database.ts
// Por enquanto, refletem o modelo de dados alvo (passo 2 + migrations).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SyncStatus = "synced" | "pending" | "conflict" | "error";

// Papéis do sistema. `super_admin` é global (dono da PersEventos); `tenant_admin`
// e `recepcao`/`staff` atuam dentro de um estabelecimento; `cliente` é o usuário
// final. `admin` é o papel legado equivalente a `tenant_admin`.
export type Papel = "super_admin" | "tenant_admin" | "admin" | "staff" | "recepcao" | "cliente";

export type InscricaoStatus = "inscrito" | "confirmado" | "checkin" | "checkout" | "cancelado";

export type PagamentoStatus = "pendente" | "pago" | "isento" | "reembolsado";

export type TermoTipo = "responsabilidade" | "imagem";

// Fase 2 — financeiro e ingressos.
export type OrderStatus = "pending" | "paid" | "canceled" | "refunded";

export type PaymentMethod = "pix" | "credit_card";

// Tenant (estabelecimento). Tabela raiz, sem tenant_id.
// Nota: usamos `type` (e não `interface`) para que o objeto seja compatível
// com `Record<string, unknown>` exigido pelos tipos do supabase-js.
export type Estabelecimento = {
  id: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  logo_url: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type Pessoa = {
  id: string;
  tenant_id?: string | null;
  nome_completo: string;
  cpf: string | null;
  rg: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  restricoes_alimentares: string | null;
  condicoes_saude: string | null;
  medicacoes: string | null;
  observacoes: string | null;
  consentimento_lgpd: boolean;
  created_at: string;
  updated_at: string;
};

export type PessoaEstabelecimento = {
  id: string;
  pessoa_id: string;
  tenant_id: string;
  origem: "cadastro" | "compra" | "inscricao" | "cliente" | "estabelecimento";
  created_at: string;
};

export type Menor = {
  id: string;
  tenant_id?: string | null;
  pessoa_id: string;
  responsavel_nome: string;
  responsavel_cpf: string;
  autorizacao_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Evento = {
  id: string;
  tenant_id?: string | null;
  nome: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  local: string | null;
  capacidade: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Inscricao = {
  id: string;
  tenant_id?: string | null;
  pessoa_id: string;
  evento_id: string;
  status: InscricaoStatus;
  data_checkin: string | null;
  data_checkout: string | null;
  pagamento_status: PagamentoStatus;
  valor: number | null;
  forma_pagamento: string | null;
  termo_assinado: boolean;
  created_at: string;
  updated_at: string;
};

export type TicketType = {
  id: string;
  tenant_id?: string | null;
  event_id: string;
  name: string;
  price: number;
  quantity_total: number;
  quantity_sold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Espaco = {
  id: string;
  tenant_id?: string | null;
  event_id: string;
  nome: string;
  price: number;
  fileiras: number;
  cadeiras_por_fileira: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AssentoStatus = "livre" | "reservado" | "vendido";

export type Assento = {
  id: string;
  tenant_id?: string | null;
  espaco_id: string;
  fileira: string;
  numero: number;
  status: AssentoStatus;
  order_id: string | null;
  reservado_ate: string | null;
  ticket_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  tenant_id?: string | null;
  customer_id: string;
  event_id: string;
  ticket_type_id: string | null;
  espaco_id?: string | null;
  quantity: number;
  total_amount: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  created_at: string;
  updated_at: string;
};

export type Ticket = {
  id: string;
  tenant_id?: string | null;
  order_id: string;
  ticket_type_id: string | null;
  customer_id: string;
  qr_code_hash: string;
  espaco_id?: string | null;
  assento_fileira?: string | null;
  assento_numero?: number | null;
  is_checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Documento = {
  id: string;
  tenant_id?: string | null;
  pessoa_id: string;
  tipo: string;
  url: string;
  uploaded_at: string;
  updated_at: string;
};

export type Termo = {
  id: string;
  tenant_id?: string | null;
  pessoa_id: string;
  evento_id: string | null;
  tipo: TermoTipo;
  aceito_em: string;
  ip: string | null;
  assinatura_url: string | null;
  created_at: string;
  updated_at: string;
};

export type LogAcessoDados = {
  id: number;
  tenant_id?: string | null;
  user_id: string | null;
  pessoa_id: string | null;
  acao: string;
  criado_em: string;
};

export type Profile = {
  id: string;
  nome: string | null;
  email: string | null;
  papel: Papel;
  tenant_id?: string | null;
  pessoa_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

// Relação (FK) no formato esperado pelo supabase-js para embeds/RPC tipados.
export type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

// `Relationships` é obrigatório para o supabase-js reconhecer a tabela.
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>, Rels extends Relationship[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Rels;
};

type Rel<Col extends string, Ref extends string> = {
  foreignKeyName: string;
  columns: [Col];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

export interface Database {
  public: {
    Tables: {
      estabelecimentos: Table<Estabelecimento>;
      pessoas: Table<
        Pessoa,
        Partial<Pessoa>,
        Partial<Pessoa>,
        [Rel<"tenant_id", "estabelecimentos">]
      >;
      pessoa_estabelecimentos: Table<
        PessoaEstabelecimento,
        Partial<PessoaEstabelecimento>,
        Partial<PessoaEstabelecimento>,
        [Rel<"pessoa_id", "pessoas">, Rel<"tenant_id", "estabelecimentos">]
      >;
      menores: Table<
        Menor,
        Partial<Menor>,
        Partial<Menor>,
        [Rel<"pessoa_id", "pessoas">, Rel<"tenant_id", "estabelecimentos">]
      >;
      eventos: Table<
        Evento,
        Partial<Evento>,
        Partial<Evento>,
        [Rel<"tenant_id", "estabelecimentos">]
      >;
      ticket_types: Table<
        TicketType,
        Partial<TicketType>,
        Partial<TicketType>,
        [Rel<"event_id", "eventos">, Rel<"tenant_id", "estabelecimentos">]
      >;
      espacos: Table<
        Espaco,
        Partial<Espaco>,
        Partial<Espaco>,
        [Rel<"event_id", "eventos">, Rel<"tenant_id", "estabelecimentos">]
      >;
      assentos: Table<
        Assento,
        Partial<Assento>,
        Partial<Assento>,
        [
          Rel<"espaco_id", "espacos">,
          Rel<"order_id", "orders">,
          Rel<"ticket_id", "tickets">,
          Rel<"tenant_id", "estabelecimentos">,
        ]
      >;
      orders: Table<
        Order,
        Partial<Order>,
        Partial<Order>,
        [
          Rel<"customer_id", "pessoas">,
          Rel<"event_id", "eventos">,
          Rel<"ticket_type_id", "ticket_types">,
          Rel<"espaco_id", "espacos">,
          Rel<"tenant_id", "estabelecimentos">,
        ]
      >;
      tickets: Table<
        Ticket,
        Partial<Ticket>,
        Partial<Ticket>,
        [
          Rel<"order_id", "orders">,
          Rel<"ticket_type_id", "ticket_types">,
          Rel<"espaco_id", "espacos">,
          Rel<"customer_id", "pessoas">,
          Rel<"tenant_id", "estabelecimentos">,
        ]
      >;
      inscricoes: Table<
        Inscricao,
        Partial<Inscricao>,
        Partial<Inscricao>,
        [
          Rel<"pessoa_id", "pessoas">,
          Rel<"evento_id", "eventos">,
          Rel<"tenant_id", "estabelecimentos">,
        ]
      >;
      documentos: Table<
        Documento,
        Partial<Documento>,
        Partial<Documento>,
        [Rel<"pessoa_id", "pessoas">, Rel<"tenant_id", "estabelecimentos">]
      >;
      termos: Table<
        Termo,
        Partial<Termo>,
        Partial<Termo>,
        [
          Rel<"pessoa_id", "pessoas">,
          Rel<"evento_id", "eventos">,
          Rel<"tenant_id", "estabelecimentos">,
        ]
      >;
      log_acesso_dados: Table<
        LogAcessoDados,
        Partial<LogAcessoDados>,
        Partial<LogAcessoDados>,
        [Rel<"tenant_id", "estabelecimentos">]
      >;
      profiles: Table<
        Profile,
        Partial<Profile>,
        Partial<Profile>,
        [Rel<"pessoa_id", "pessoas">, Rel<"tenant_id", "estabelecimentos">]
      >;
    };
    Views: Record<string, never>;
    Functions: {
      confirm_order_payment: {
        Args: { p_order_id: string; p_hashes: string[] };
        Returns: Order;
      };
      criar_espaco: {
        Args: {
          p_event_id: string;
          p_nome: string;
          p_price: number;
          p_fileiras: number;
          p_cadeiras_por_fileira: number;
        };
        Returns: Espaco;
      };
      liberar_reservas_expiradas: {
        Args: Record<string, never>;
        Returns: number;
      };
      reservar_assentos: {
        Args: {
          p_espaco_id: string;
          p_assento_ids: string[];
          p_payment_method: PaymentMethod;
        };
        Returns: Order;
      };
      selecionar_estabelecimento: {
        Args: { p_tenant_id: string };
        Returns: Estabelecimento;
      };
      vincular_pessoa: {
        Args: { p_cpf: string | null; p_email: string | null };
        Returns: Pessoa;
      };
    };
    Enums: {
      sync_status: SyncStatus;
      papel: Papel;
      inscricao_status: InscricaoStatus;
      pagamento_status: PagamentoStatus;
      termo_tipo: TermoTipo;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
    };
  };
}
