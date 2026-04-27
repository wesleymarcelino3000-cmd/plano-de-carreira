-- Criar bucket para fotos
insert into storage.buckets (id, name, public)
values ('fotos-funcionarios', 'fotos-funcionarios', true)
on conflict do nothing;

-- Liberar acesso público
create policy "Public Access Fotos"
on storage.objects for select
using (bucket_id = 'fotos-funcionarios');

create policy "Upload Fotos"
on storage.objects for insert
with check (bucket_id = 'fotos-funcionarios');
