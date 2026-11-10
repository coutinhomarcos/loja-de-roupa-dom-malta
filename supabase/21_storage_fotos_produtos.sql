begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('produtos','produtos',true,1048576,array['image/webp','image/jpeg','image/png'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "Loja admin envia fotos" on storage.objects for insert to authenticated
with check(bucket_id='produtos' and exists(select 1 from public.administradores where usuario_id=(select auth.uid())));
create policy "Loja admin consulta arquivos" on storage.objects for select to authenticated
using(bucket_id='produtos' and exists(select 1 from public.administradores where usuario_id=(select auth.uid())));
create policy "Loja admin remove fotos" on storage.objects for delete to authenticated
using(bucket_id='produtos' and exists(select 1 from public.administradores where usuario_id=(select auth.uid())));
commit;
