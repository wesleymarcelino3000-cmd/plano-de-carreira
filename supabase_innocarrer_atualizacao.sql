-- Atualização InnoCarrer
-- Execute este SQL no Supabase antes de usar login por usuário e seleção de funções.

alter table public.usuarios
add column if not exists usuario text;

alter table public.usuarios
add column if not exists email text;

alter table public.usuarios
add column if not exists permissoes jsonb default '{"dashboard":true,"ranking":true,"editarMeuUsuario":true,"planoCarreira":true}'::jsonb;

create unique index if not exists usuarios_usuario_unique
on public.usuarios (lower(usuario))
where usuario is not null;

-- Preenche usuário automaticamente para perfis antigos que ainda estejam sem usuário.
update public.usuarios
set usuario = lower(regexp_replace(coalesce(nome, split_part(email,'@',1), id::text), '[^a-zA-Z0-9._-]+', '.', 'g'))
where usuario is null;

-- Libera tudo para administradores existentes.
update public.usuarios
set permissoes = '{
  "dashboard":true,
  "sac":true,
  "logistica":true,
  "vendas":true,
  "marketing":true,
  "ranking":true,
  "metas":true,
  "metasIndividuais":true,
  "criarUsuario":true,
  "editarMeuUsuario":true,
  "planoCarreira":true
}'::jsonb
where lower(coalesce(nivel,'')) = 'admin';
