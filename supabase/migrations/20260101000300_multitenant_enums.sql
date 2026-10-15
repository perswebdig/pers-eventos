-- =============================================================================
-- PersEventos — Multitenant: novos papéis (RBAC)
-- Arquivo separado de propósito: `ALTER TYPE ... ADD VALUE` não pode ser usado
-- na mesma transação em que o valor novo é referenciado.
-- =============================================================================

alter type public.papel add value if not exists 'super_admin';
alter type public.papel add value if not exists 'tenant_admin';
alter type public.papel add value if not exists 'cliente';
