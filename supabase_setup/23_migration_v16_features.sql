-- ============================================================
-- v16 — Features: alertas persistentes, e-mails, auditoria,
-- checklist por itens, aprovação de solicitações.
-- ============================================================

-- 1) Alertas dispensados (persistente por usuário) ----------
create table if not exists public.alerts_dismissed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, alert_key)
);
alter table public.alerts_dismissed enable row level security;
drop policy if exists "alerts_dismissed_owner_all" on public.alerts_dismissed;
create policy "alerts_dismissed_owner_all" on public.alerts_dismissed
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Notificações por e-mail (controle de reenvio) ----------
create table if not exists public.notifications_sent (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  sent_at timestamptz not null default now()
);
create index if not exists notifications_sent_key_date_idx
  on public.notifications_sent (alert_key, sent_at);
alter table public.notifications_sent enable row level security;
drop policy if exists "notifications_sent_admin_read" on public.notifications_sent;
create policy "notifications_sent_admin_read" on public.notifications_sent
  for select using (public.has_role(auth.uid(), 'admin'));

-- 3) Auditoria -----------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  tabela text not null,
  registro_id text not null,
  acao text not null check (acao in ('insert','update','delete')),
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_tabela_reg_idx
  on public.audit_log (tabela, registro_id, created_at desc);
alter table public.audit_log enable row level security;
drop policy if exists "audit_log_admin_read" on public.audit_log;
create policy "audit_log_admin_read" on public.audit_log
  for select using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "audit_log_self_insert" on public.audit_log;
create policy "audit_log_self_insert" on public.audit_log
  for insert to authenticated with check (auth.uid() = user_id);

-- 4) Checklist — coluna `itens` JSONB ------------------------
alter table public.checklists
  add column if not exists itens jsonb not null default '[]'::jsonb;

-- 5) Solicitações — fluxo de aprovação -----------------------
alter table public.requests
  add column if not exists aprovado_por uuid references auth.users(id),
  add column if not exists aprovado_em timestamptz,
  add column if not exists rejeitado_motivo text;

-- Atualiza CHECK do status para aceitar approved/rejected
do $$
declare
  ck text;
begin
  select conname into ck
  from pg_constraint
  where conrelid = 'public.requests'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';
  if ck is not null then
    execute format('alter table public.requests drop constraint %I', ck);
  end if;
end$$;

alter table public.requests
  add constraint requests_status_check
  check (status in ('requested','pending','approved','rejected','completed'));

-- ============================================================
-- pg_cron: agendar Edge Function notify-alerts às 08h
-- (Execute manualmente após criar a Edge Function e definir
--  app.notify_alerts_url e app.service_role_key nas variáveis
--  do projeto — vide instruções no README desta migração.)
-- ============================================================
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'notify-alerts-daily',
--   '0 11 * * *',  -- 08h em America/Sao_Paulo (UTC-3) = 11h UTC
--   $$
--   select net.http_post(
--     url := current_setting('app.notify_alerts_url'),
--     headers := jsonb_build_object(
--       'Content-Type','application/json',
--       'Authorization','Bearer '||current_setting('app.service_role_key')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
