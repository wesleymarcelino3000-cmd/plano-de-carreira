-- FOTOS DOS FUNCIONÁRIOS NO SUPABASE
-- Rode no SQL Editor do Supabase.

alter table public.funcionarios
add column if not exists foto text;

insert into storage.buckets (id, name, public)
values ('fotos-funcionarios', 'fotos-funcionarios', true)
on conflict (id) do nothing;

drop policy if exists "Public Access Fotos" on storage.objects;
drop policy if exists "Upload Fotos" on storage.objects;

create policy "Public Access Fotos"
on storage.objects for select
using (bucket_id = 'fotos-funcionarios');

create policy "Upload Fotos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'fotos-funcionarios');
