-- =============================================================================
-- PersEventos — schema base
-- Enums, tabelas, índices e triggers de updated_at.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.papel as enum ('admin', 'staff', 'recepcao');

create type public.inscricao_status as enum
  ('inscrito', 'confirmado', 'checkin', 'checkout', 'cancelado');

create type public.pagamento_status as enum
  ('pendente', 'pago', 'isento', 'reembolsado');

create type public.termo_tipo as enum ('responsabilidade', 'imagem');

-- ---------------------------------------------------------------------------
-- perfis (espelha auth.users; papel define permissões via RLS)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text,
  papel      public.papel not null default 'recepcao',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pessoas
-- ---------------------------------------------------------------------------
create table public.pessoas (
  id                          uuid primary key default gen_random_uuid(),
  nome_completo               text not null,
  cpf                         text unique,
  rg                          text,
  data_nascimento             date,
  telefone                    text,
  email                       text,
  endereco                    text,
  contato_emergencia_nome     text,
  contato_emergencia_telefone text,
  restricoes_alimentares      text,
  condicoes_saude             text,
  medicacoes                  text,
  observacoes                 text,
  consentimento_lgpd          boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index pessoas_nome_idx       on public.pessoas (lower(nome_completo));
create index pessoas_cpf_idx        on public.pessoas (cpf);
create index pessoas_telefone_idx   on public.pessoas (telefone);
create index pessoas_updated_at_idx on public.pessoas (updated_at);

-- ---------------------------------------------------------------------------
-- menores (dados do responsável para visitantes < 18)
-- ---------------------------------------------------------------------------
create table public.menores (
  id                uuid primary key default gen_random_uuid(),
  pessoa_id         uuid not null references public.pessoas (id) on delete cascade,
  responsavel_nome  text not null,
  responsavel_cpf   text not null,
  autorizacao_url   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index menores_pessoa_idx     on public.menores (pessoa_id);
create index menores_updated_at_idx on public.menores (updated_at);

-- ---------------------------------------------------------------------------
-- eventos
-- ---------------------------------------------------------------------------
create table public.eventos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  descricao   text,
  data_inicio timestamptz not null,
  data_fim    timestamptz,
  local       text,
  capacidade  integer,
  status      text not null default 'planejado',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index eventos_status_idx     on public.eventos (status);
create index eventos_data_idx       on public.eventos (data_inicio);
create index eventos_updated_at_idx on public.eventos (updated_at);

-- ---------------------------------------------------------------------------
-- inscricoes
-- ---------------------------------------------------------------------------
create table public.inscricoes (
  id                uuid primary key default gen_random_uuid(),
  pessoa_id         uuid not null references public.pessoas (id) on delete cascade,
  evento_id         uuid not null references public.eventos (id) on delete cascade,
  status            public.inscricao_status not null default 'inscrito',
  data_checkin      timestamptz,
  data_checkout     timestamptz,
  pagamento_status  public.pagamento_status not null default 'pendente',
  valor             numeric(10, 2),
  forma_pagamento   text,
  termo_assinado    boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (evento_id, pessoa_id)
);

create index inscricoes_evento_idx     on public.inscricoes (evento_id);
create index inscricoes_pessoa_idx     on public.inscricoes (pessoa_id);
create index inscricoes_status_idx     on public.inscricoes (evento_id, status);
create index inscricoes_updated_at_idx on public.inscricoes (updated_at);

-- ---------------------------------------------------------------------------
-- documentos (RG/CPF, fotos, laudos)
-- ---------------------------------------------------------------------------
create table public.documentos (
  id          uuid primary key default gen_random_uuid(),
  pessoa_id   uuid not null references public.pessoas (id) on delete cascade,
  tipo        text not null,
  url         text not null,
  uploaded_at timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index documentos_pessoa_idx     on public.documentos (pessoa_id);
create index documentos_updated_at_idx on public.documentos (updated_at);

-- ---------------------------------------------------------------------------
-- termos (responsabilidade / imagem)
-- ---------------------------------------------------------------------------
create table public.termos (
  id             uuid primary key default gen_random_uuid(),
  pessoa_id      uuid not null references public.pessoas (id) on delete cascade,
  evento_id      uuid references public.eventos (id) on delete set null,
  tipo           public.termo_tipo not null,
  aceito_em      timestamptz not null default now(),
  ip             text,
  assinatura_url text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index termos_pessoa_idx     on public.termos (pessoa_id);
create index termos_evento_idx     on public.termos (evento_id, tipo);
create index termos_updated_at_idx on public.termos (updated_at);

-- ---------------------------------------------------------------------------
-- log_acesso_dados (LGPD: quem acessou dados sensíveis)
-- ---------------------------------------------------------------------------
create table public.log_acesso_dados (
  id        bigint generated always as identity primary key,
  user_id   uuid references auth.users (id) on delete set null,
  pessoa_id uuid,
  acao      text not null,
  criado_em timestamptz not null default now()
);

create index log_acesso_pessoa_idx on public.log_acesso_dados (pessoa_id);
create index log_acesso_user_idx   on public.log_acesso_dados (user_id);

-- ---------------------------------------------------------------------------
-- Trigger genérica de updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'pessoas', 'menores', 'eventos', 'inscricoes', 'documentos', 'termos']
  loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end;
$$;
