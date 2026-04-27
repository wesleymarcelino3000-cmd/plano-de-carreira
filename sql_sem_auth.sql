-- remover auth e liberar tabelas
alter table public.usuarios disable row level security;
alter table public.funcionarios disable row level security;

alter table public.usuarios add column if not exists senha_hash text;
