-- Execute este SQL no Supabase apenas uma vez
create table if not exists public.metas_individuais (
  id uuid primary key default gen_random_uuid(),
  setor text not null,
  funcionario_id text,
  funcionario_nome text not null,
  meta numeric default 0,
  realizado numeric default 0,
  bonus numeric default 0,
  created_at timestamp with time zone default now()
);

alter table public.metas_individuais enable row level security;

create policy if not exists "Permitir leitura metas individuais"
on public.metas_individuais for select
using (true);

create policy if not exists "Permitir inserir metas individuais"
on public.metas_individuais for insert
with check (true);

create policy if not exists "Permitir atualizar metas individuais"
on public.metas_individuais for update
using (true)
with check (true);

create policy if not exists "Permitir excluir metas individuais"
on public.metas_individuais for delete
using (true);
