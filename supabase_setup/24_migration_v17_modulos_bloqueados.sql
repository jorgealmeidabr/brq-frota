-- v17: Módulos bloqueados (kill-switch global por módulo)
-- Quando um módulo está bloqueado:
--  - some do menu para não-admins
--  - admin vê com cadeado e pode reativar
--  - rotas são bloqueadas
--  - regras dependentes (ex.: checklist obrigatório) são suspensas

create table if not exists public.modulos_bloqueados (
  modulo text primary key,
  bloqueado boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.modulos_bloqueados enable row level security;

-- Qualquer usuário autenticado pode ler (precisa para esconder do menu)
drop policy if exists "modulos_bloqueados_select_all" on public.modulos_bloqueados;
create policy "modulos_bloqueados_select_all"
on public.modulos_bloqueados for select
to authenticated
using (true);

-- Apenas admin pode escrever
drop policy if exists "modulos_bloqueados_admin_write" on public.modulos_bloqueados;
create policy "modulos_bloqueados_admin_write"
on public.modulos_bloqueados for all
to authenticated
using (public.is_admin_perfil(auth.uid()))
with check (public.is_admin_perfil(auth.uid()));

-- Realtime
alter publication supabase_realtime add table public.modulos_bloqueados;
