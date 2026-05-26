-- ============================================================
-- v17 — Bloqueio global de módulos (admin)
-- Permite ao admin desativar totalmente um módulo do sistema.
-- Para usuários comuns o módulo deixa de existir; para o admin
-- ele continua visível com indicação de bloqueado e pode ser
-- reativado a qualquer momento.
-- ============================================================

create table if not exists public.modulos_bloqueados (
  modulo text primary key,
  bloqueado_em timestamptz not null default now(),
  bloqueado_por uuid references auth.users(id)
);

alter table public.modulos_bloqueados enable row level security;

-- Todos os usuários autenticados podem LER (necessário para esconder o módulo no client)
drop policy if exists "modulos_bloqueados_read_all" on public.modulos_bloqueados;
create policy "modulos_bloqueados_read_all" on public.modulos_bloqueados
  for select to authenticated using (true);

-- Apenas admin pode INSERIR / DELETAR
drop policy if exists "modulos_bloqueados_admin_write" on public.modulos_bloqueados;
create policy "modulos_bloqueados_admin_write" on public.modulos_bloqueados
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
