-- =============================================================================
-- PersEventos — Multitenant: Row Level Security por tenant_id + papel (RBAC)
--
-- Regra geral: um usuário só enxerga/grava linhas do seu próprio tenant
-- (tenant_id = current_tenant_id()); o Super Admin enxerga tudo.
-- =============================================================================

alter table public.estabelecimentos enable row level security;

-- --------------------------------------------------------------------------
-- Remove as policies da versão anterior (single-tenant).
-- --------------------------------------------------------------------------
drop policy if exists "profiles_select"   on public.profiles;
drop policy if exists "profiles_update"   on public.profiles;

drop policy if exists "pessoas_select"    on public.pessoas;
drop policy if exists "pessoas_insert"    on public.pessoas;
drop policy if exists "pessoas_update"    on public.pessoas;
drop policy if exists "pessoas_delete"    on public.pessoas;

drop policy if exists "menores_select"    on public.menores;
drop policy if exists "menores_insert"    on public.menores;
drop policy if exists "menores_update"    on public.menores;
drop policy if exists "menores_delete"    on public.menores;

drop policy if exists "eventos_select"    on public.eventos;
drop policy if exists "eventos_insert"    on public.eventos;
drop policy if exists "eventos_update"    on public.eventos;
drop policy if exists "eventos_delete"    on public.eventos;

drop policy if exists "inscricoes_select" on public.inscricoes;
drop policy if exists "inscricoes_insert" on public.inscricoes;
drop policy if exists "inscricoes_update" on public.inscricoes;
drop policy if exists "inscricoes_delete" on public.inscricoes;

drop policy if exists "documentos_select" on public.documentos;
drop policy if exists "documentos_insert" on public.documentos;
drop policy if exists "documentos_update" on public.documentos;
drop policy if exists "documentos_delete" on public.documentos;

drop policy if exists "termos_select"     on public.termos;
drop policy if exists "termos_insert"     on public.termos;
drop policy if exists "termos_update"     on public.termos;
drop policy if exists "termos_delete"     on public.termos;

drop policy if exists "log_insert"        on public.log_acesso_dados;
drop policy if exists "log_select"        on public.log_acesso_dados;

-- --------------------------------------------------------------------------
-- estabelecimentos (somente Super Admin escreve; tenant lê o próprio)
-- --------------------------------------------------------------------------
create policy "estabelecimentos_select" on public.estabelecimentos
  for select to authenticated
  using (public.is_super_admin() or id = public.current_tenant_id());

create policy "estabelecimentos_insert" on public.estabelecimentos
  for insert to authenticated
  with check (public.is_super_admin());

create policy "estabelecimentos_update" on public.estabelecimentos
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "estabelecimentos_delete" on public.estabelecimentos
  for delete to authenticated
  using (public.is_super_admin());

-- --------------------------------------------------------------------------
-- profiles
--   enxerga o próprio perfil, ou os usuários do seu tenant (admin do tenant),
--   ou todos (super admin).
-- --------------------------------------------------------------------------
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_super_admin()
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin())
  );

create policy "profiles_insert" on public.profiles
  for insert to authenticated
  with check (public.is_super_admin());

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    or public.is_super_admin()
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin())
  )
  with check (
    id = (select auth.uid())
    or public.is_super_admin()
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin())
  );

-- --------------------------------------------------------------------------
-- pessoas
-- --------------------------------------------------------------------------
create policy "pessoas_select" on public.pessoas
  for select to authenticated
  using (public.same_tenant(tenant_id));

create policy "pessoas_insert" on public.pessoas
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.same_tenant(tenant_id) and (public.is_staff_or_admin() or public.is_cliente()))
  );

create policy "pessoas_update" on public.pessoas
  for update to authenticated
  using (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_staff_or_admin() or id = public.current_pessoa_id()))
  )
  with check (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_staff_or_admin() or id = public.current_pessoa_id()))
  );

create policy "pessoas_delete" on public.pessoas
  for delete to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

-- --------------------------------------------------------------------------
-- menores
-- --------------------------------------------------------------------------
create policy "menores_select" on public.menores
  for select to authenticated
  using (public.same_tenant(tenant_id));

create policy "menores_insert" on public.menores
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.same_tenant(tenant_id) and (public.is_staff_or_admin() or public.is_cliente()))
  );

create policy "menores_update" on public.menores
  for update to authenticated
  using (public.same_tenant(tenant_id))
  with check (public.same_tenant(tenant_id));

create policy "menores_delete" on public.menores
  for delete to authenticated
  using (
    public.is_super_admin()
    or (public.same_tenant(tenant_id) and (public.is_staff_or_admin() or public.is_cliente()))
  );

-- --------------------------------------------------------------------------
-- eventos (escrita: admin do estabelecimento)
-- --------------------------------------------------------------------------
create policy "eventos_select" on public.eventos
  for select to authenticated
  using (public.same_tenant(tenant_id));

create policy "eventos_insert" on public.eventos
  for insert to authenticated
  with check (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

create policy "eventos_update" on public.eventos
  for update to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()))
  with check (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

create policy "eventos_delete" on public.eventos
  for delete to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

-- --------------------------------------------------------------------------
-- inscricoes (cliente gerencia as próprias; recepção faz check-in)
-- --------------------------------------------------------------------------
create policy "inscricoes_select" on public.inscricoes
  for select to authenticated
  using (public.same_tenant(tenant_id));

create policy "inscricoes_insert" on public.inscricoes
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.same_tenant(tenant_id) and (public.is_staff_or_admin() or public.is_cliente()))
  );

create policy "inscricoes_update" on public.inscricoes
  for update to authenticated
  using (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_staff_or_admin() or pessoa_id = public.current_pessoa_id()))
  )
  with check (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_staff_or_admin() or pessoa_id = public.current_pessoa_id()))
  );

create policy "inscricoes_delete" on public.inscricoes
  for delete to authenticated
  using (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_tenant_admin() or pessoa_id = public.current_pessoa_id()))
  );

-- --------------------------------------------------------------------------
-- documentos
-- --------------------------------------------------------------------------
create policy "documentos_select" on public.documentos
  for select to authenticated
  using (public.same_tenant(tenant_id));

create policy "documentos_insert" on public.documentos
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_staff_or_admin() or pessoa_id = public.current_pessoa_id()))
  );

create policy "documentos_update" on public.documentos
  for update to authenticated
  using (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_staff_or_admin() or pessoa_id = public.current_pessoa_id()))
  )
  with check (
    public.is_super_admin()
    or (public.same_tenant(tenant_id)
        and (public.is_staff_or_admin() or pessoa_id = public.current_pessoa_id()))
  );

create policy "documentos_delete" on public.documentos
  for delete to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

-- --------------------------------------------------------------------------
-- termos (cliente e recepção assinam)
-- --------------------------------------------------------------------------
create policy "termos_select" on public.termos
  for select to authenticated
  using (public.same_tenant(tenant_id));

create policy "termos_insert" on public.termos
  for insert to authenticated
  with check (public.same_tenant(tenant_id));

create policy "termos_update" on public.termos
  for update to authenticated
  using (public.same_tenant(tenant_id))
  with check (public.same_tenant(tenant_id));

create policy "termos_delete" on public.termos
  for delete to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

-- --------------------------------------------------------------------------
-- log_acesso_dados (grava o próprio acesso; leitura: admin do tenant/super)
-- --------------------------------------------------------------------------
create policy "log_insert" on public.log_acesso_dados
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "log_select" on public.log_acesso_dados
  for select to authenticated
  using (public.is_super_admin() or (public.same_tenant(tenant_id) and public.is_tenant_admin()));

-- --------------------------------------------------------------------------
-- Privilégios
-- --------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
