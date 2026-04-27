-- INNOCARRER - LOGIN SEM SUPABASE AUTH / SEM RATE LIMIT
-- Rode no SQL Editor do Supabase.

create extension if not exists "pgcrypto";

alter table public.usuarios add column if not exists senha_hash text;
alter table public.usuarios add column if not exists usuario text;
alter table public.usuarios add column if not exists permissoes jsonb default '{}'::jsonb;
alter table public.funcionarios add column if not exists foto text;

update public.usuarios
set senha_hash = encode(digest('123456','sha256'),'hex')
where senha_hash is null;

create unique index if not exists usuarios_usuario_unique on public.usuarios (usuario);

alter table public.usuarios disable row level security;
alter table public.funcionarios disable row level security;
alter table public.metas disable row level security;
alter table public.metas_individuais disable row level security;
alter table if exists public.planos_carreira disable row level security;
alter table if exists public.niveis_carreira disable row level security;
alter table if exists public.historico_pontos disable row level security;

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
with check (bucket_id = 'fotos-funcionarios');
