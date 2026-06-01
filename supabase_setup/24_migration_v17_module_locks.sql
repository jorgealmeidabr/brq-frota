-- ============================================================
-- v17 — Bloqueio global de módulos (feature flags por módulo)
-- Admin pode trancar um módulo: usuários comuns deixam de vê-lo,
-- admins continuam vendo com um cadeado indicando o bloqueio.
-- ============================================================

create table if not exists public.modulos_bloqueados (
  modulo text primary key,
  bloqueado boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- Data API grants
grant select on public.modulos_bloqueados to authenticated;
grant select on public.modulos_bloqueados to anon;
grant all on public.modulos_bloqueados to service_role;

alter table public.modulos_bloqueados enable row level security;

-- Todos autenticados podem LER quais módulos estão bloqueados
drop policy if exists "modulos_bloqueados_read" on public.modulos_bloqueados;
create policy "modulos_bloqueados_read" on public.modulos_bloqueados
  for select to authenticated using (true);

-- Apenas admins podem alterar (insert/update/delete)
drop policy if exists "modulos_bloqueados_admin_write" on public.modulos_bloqueados;
create policy "modulos_bloqueados_admin_write" on public.modulos_bloqueados
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_admin_perfil(auth.uid()))
  with check (public.has_role(auth.uid(), 'admin') or public.is_admin_perfil(auth.uid()));
