-- Service role (usado apenas por rotas server-side confiáveis) pode atualizar
-- papel/tenant de usuários. A proteção continua valendo para usuários
-- autenticados comuns, que só alteram papel via Super Admin (trigger original).
create or replace function public.prevent_papel_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.role()) = 'service_role' then
    return new;
  end if;

  if public.is_super_admin() then
    return new;
  end if;

  if new.papel is distinct from old.papel then
    raise exception 'Apenas administradores podem alterar o papel de um usuário';
  end if;

  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'Apenas o Super Admin pode mover um usuário entre estabelecimentos';
  end if;

  return new;
end;
$$;
