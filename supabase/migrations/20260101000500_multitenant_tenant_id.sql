-- =============================================================================
-- PersEventos — Multitenant: tenant_id em todas as tabelas de domínio
-- =============================================================================

-- Coluna tenant_id (FK para estabelecimentos) em cada tabela isolada.
alter table public.pessoas          add column if not exists tenant_id uuid references public.estabelecimentos (id) on delete cascade;
alter table public.menores          add column if not exists tenant_id uuid references public.estabelecimentos (id) on delete cascade;
alter table public.eventos          add column if not exists tenant_id uuid references public.estabelecimentos (id) on delete cascade;
alter table public.inscricoes       add column if not exists tenant_id uuid references public.estabelecimentos (id) on delete cascade;
alter table public.documentos       add column if not exists tenant_id uuid references public.estabelecimentos (id) on delete cascade;
alter table public.termos           add column if not exists tenant_id uuid references public.estabelecimentos (id) on delete cascade;
alter table public.log_acesso_dados add column if not exists tenant_id uuid references public.estabelecimentos (id) on delete set null;

-- Índices para as consultas por tenant (as policies usam muito este filtro).
create index if not exists pessoas_tenant_idx          on public.pessoas (tenant_id);
create index if not exists menores_tenant_idx          on public.menores (tenant_id);
create index if not exists eventos_tenant_idx          on public.eventos (tenant_id);
create index if not exists inscricoes_tenant_idx       on public.inscricoes (tenant_id);
create index if not exists documentos_tenant_idx       on public.documentos (tenant_id);
create index if not exists termos_tenant_idx           on public.termos (tenant_id);
create index if not exists log_acesso_tenant_idx       on public.log_acesso_dados (tenant_id);

-- Carimbo automático + bloqueio de escrita cross-tenant.
do $$
declare
  t text;
begin
  foreach t in array array['pessoas', 'menores', 'eventos', 'inscricoes', 'documentos', 'termos', 'log_acesso_dados']
  loop
    execute format('drop trigger if exists %I_set_tenant_id on public.%I', t, t);
    execute format(
      'create trigger %I_set_tenant_id before insert or update on public.%I
         for each row execute function public.set_tenant_id()',
      t, t
    );
  end loop;
end;
$$;
