-- =============================================================================
-- PersEventos — buckets e políticas de Storage
-- Convenções de caminho:
--   documentos:  pessoas/{pessoa_id}/{uuid}.{ext}
--   assinaturas: termos/{termo_id}.png
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('documentos', 'documentos', false),
  ('assinaturas', 'assinaturas', false)
on conflict (id) do nothing;

-- Leitura: qualquer usuário autenticado.
create policy "documentos_read" on storage.objects
  for select to authenticated using (bucket_id in ('documentos', 'assinaturas'));

-- Escrita de documentos: staff/admin.
create policy "documentos_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and public.is_staff_or_admin());

create policy "documentos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos' and public.is_staff_or_admin())
  with check (bucket_id = 'documentos' and public.is_staff_or_admin());

create policy "documentos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and public.is_admin());

-- Assinaturas: a recepção também faz upload no check-in.
create policy "assinaturas_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assinaturas');

create policy "assinaturas_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'assinaturas')
  with check (bucket_id = 'assinaturas');

create policy "assinaturas_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assinaturas' and public.is_admin());
