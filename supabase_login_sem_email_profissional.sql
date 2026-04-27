-- INNOCARRER - LOGIN SEM EMAIL PROFISSIONAL
-- Rode este SQL no Supabase antes de subir o novo ZIP.
-- Ele remove a dependência do Supabase Auth para login dos funcionários.

create extension if not exists "pgcrypto";

alter table public.usuarios
add column if not exists senha_hash text;

alter table public.usuarios
add column if not exists usuario text;

alter table public.usuarios
add column if not exists permissoes jsonb default '{}'::jsonb;

alter table public.funcionarios
add column if not exists foto text;

-- Senha inicial temporária para usuários antigos que ainda não têm senha_hash:
-- usuário: o usuário já cadastrado
-- senha: 123456
update public.usuarios
set senha_hash = encode(digest('123456','sha256'),'hex')
where senha_hash is null;

-- Garante usuário único
create unique index if not exists usuarios_usuario_unique
on public.usuarios (usuario);

-- IMPORTANTE:
-- Como o login agora consulta a tabela usuarios sem Supabase Auth,
-- as tabelas abaixo precisam estar acessíveis pela chave pública do projeto.
-- Para sistema interno simples, isso resolve o bloqueio de login.
alter table public.usuarios disable row level security;
alter table public.funcionarios disable row level security;
alter table public.metas disable row level security;
alter table public.metas_individuais disable row level security;

-- Se você já criou essas tabelas do plano profissional:
alter table if exists public.planos_carreira disable row level security;
alter table if exists public.niveis_carreira disable row level security;
alter table if exists public.historico_pontos disable row level security;

-- Storage de fotos
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
