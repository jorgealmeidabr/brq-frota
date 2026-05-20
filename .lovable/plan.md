# Plano de Implementação — BRQ Frota

Escopo grande (8 frentes). Vou implementar tudo de forma integrada, mantendo padrão visual (shadcn/Tailwind/dark mode), permissões (`usePermissions`, `isAdmin`) e nomenclatura PT-BR.

> ⚠️ **Importante sobre as credenciais Gmail**: você colou usuário e App Password no chat. Vou armazená-los como **secrets do Lovable Cloud** (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) — nunca em código. Recomendo **revogar** essa senha de app no Google e gerar uma nova depois, já que ficou exposta no histórico.

---

## 1. Alertas persistentes no banco

**Migration**

```sql
create table public.alerts_dismissed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, alert_key)
);
alter table public.alerts_dismissed enable row level security;
create policy "user manages own dismissals" on public.alerts_dismissed
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Hook** — reescrever `src/hooks/useDismissedAlerts.ts` mantendo a mesma interface (`isDismissed`, `dismiss`, `dismissMany`, `restore`, `clearAll`). Carrega `Set<string>` por usuário via `select`, faz `insert`/`delete` otimista com rollback em erro. Mantém um cache em memória + subscription opcional para sincronizar entre abas.

---

## 2. Notificações por e-mail (Gmail SMTP)

**Secrets** (via tool de secrets do Cloud, não em código):

- `GMAIL_USER jorgealmeidabrq@gmail.com`
- `GMAIL_APP_PASSWORD ffur xvgj ozyy pltb`

**Migration**

```sql
create table public.notifications_sent (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  sent_at timestamptz not null default now()
);
create index on public.notifications_sent (alert_key, sent_at);
```

**Edge Function** `supabase/functions/notify-alerts/index.ts`

- Nodemailer via `npm:nodemailer` (host `smtp.gmail.com`, porta 465, SSL).
- Usa `service_role` para ler `veiculos`, `motoristas`, `multas`, `manutencoes`, `perfis`.
- Calcula alertas: CNH ≤30d ou vencida, manutenção atrasada (data ou km), IPVA `pendente`, seguro ≤30d, CRLV ≤30d.
- Gera `alert_key` determinístico (ex.: `cnh:<motorista_id>:<vencimento>`).
- Filtra contra `notifications_sent` no mesmo dia (`sent_at::date = current_date`).
- Busca admins (`perfis.tipo_conta = 'admin'`) → envia 1 e-mail HTML por admin com seções agrupadas.
- Registra cada `alert_key` enviado em `notifications_sent`.

**Cron diário 08:00** via `pg_cron` chamando a Edge Function com auth header.

---

## 3. Módulo Financeiro (`/financeiro`)

**Arquivo** `src/pages/Financeiro.tsx`

- KPIs (cards): custo total do mês, custo médio por veículo, custo por motorista, R$/km.
- Gráfico de barras empilhadas (recharts) últimos 6 meses por categoria: manutenção, abastecimento, multas.
- Tabela com filtros: date range (`de`/`até`), veículo (select), categoria (select).
- Botão **Exportar CSV** usando `downloadCSV` de `src/lib/csv.ts`.
- Fontes: somar `manutencoes.valor`, `abastecimentos.valor_total`, `multas.valor` no período.

**Roteamento**

- `App.tsx`: `<Route path="/financeiro" element={<Protected perm="financeiro"><Financeiro/></Protected>} />`
- `AppLayout.tsx`: novo item no grupo **Gestão** (ícone `DollarSign`, perm `financeiro`).

---

## 4. CSV com filtro de período

Páginas: `Manutencoes`, `Abastecimentos`, `Agendamentos`, `Historico`.

- Adicionar header com dois inputs `type="date"` (`de` / `até`), persistidos em estado local.
- Filtro aplicado tanto na listagem renderizada quanto no `downloadCSV`.
- Defaults: últimos 30 dias.

---

## 5. KM atualizado ao concluir agendamento

Em `Agendamentos.tsx`, no dialog de devolução:

- Novo campo obrigatório **KM final** (number).
- Validação: `km_final > veiculo.km_atual` (toast de erro caso contrário).
- Ao confirmar: `update agendamentos set status='concluido', km_final=...` + `update veiculos set km_atual=km_final where id=...`.

---

## 6. Checklist por itens visuais

**Migration**

```sql
alter table public.checklists add column if not exists itens jsonb not null default '[]'::jsonb;
```

**Itens fixos** (constante compartilhada):
`["Pneus", "Freios", "Lanternas", "Retrovisores", "Limpadores de parabrisa"]`

Cada item: `{ nome, status: 'ok'|'problema'|'nao_verificado' }`.

- Form de checklist: 5 grupos de 3 radios (OK / Problema / Não verificado).
- Status geral: `problema` se algum item for `problema`, senão `ok`.
- `VeiculoChecklistStatus.tsx`: listar **somente** itens com `status='problema'` em destaque (vermelho), e indicar "Todos os itens OK" quando aplicável. Manter exibição do nível de combustível atual.

---

## 7. Log de auditoria

**Migration**

```sql
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  tabela text not null,
  registro_id text not null,
  acao text not null check (acao in ('insert','update','delete')),
  dados_antes jsonb,
  dados_depois jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy "admins leem auditoria" on public.audit_log for select
  using (public.has_role(auth.uid(),'admin'));
create policy "usuarios autenticados inserem" on public.audit_log for insert
  to authenticated with check (auth.uid() = user_id);
create index on public.audit_log (tabela, registro_id, created_at desc);
```

**Hook** `src/hooks/useAuditLog.ts`

- `logAction(tabela, registro_id, acao, dados_antes?, dados_depois?)` → `insert` com `user_id = auth.uid()`.
- Chamado em insert/update/delete de: `Veiculos`, `Motoristas`, `Manutencoes`, `Multas`.

**UI**

- Nova aba **Auditoria** em `VeiculoDetalhe.tsx` (filtra `tabela='veiculos' and registro_id=<id>`).
- Idem em `MotoristaDetalhe.tsx` (`tabela='motoristas'`).
- Render: data, usuário (join via `perfis`), ação (badge), diff dos campos alterados (compara `dados_antes` × `dados_depois`).

---

## 8. Fluxo de aprovação em Solicitações

**Migration**

```sql
alter table public.requests
  add column if not exists aprovado_por uuid references auth.users(id),
  add column if not exists aprovado_em timestamptz,
  add column if not exists rejeitado_motivo text;

alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests add constraint requests_status_check
  check (status in ('requested','pending','approved','rejected','completed'));
```

**Fluxo**

- Admin entra na lista → marca itens visualizados como `pending` (lote).
- Botões **Aprovar** / **Rejeitar** (admin, status `requested`|`pending`).
- Rejeitar abre dialog com textarea obrigatório → grava `status='rejected'`, `rejeitado_motivo`.
- Aprovar:
  - Grava `status='approved'`, `aprovado_por=auth.uid()`, `aprovado_em=now()`.
  - Se `tipo='maintenance'` → `insert` em `manutencoes` com dados da solicitação.
  - Se `tipo='fuel'` → `insert` em `abastecimentos`.
  - Marca `completed` após criação bem-sucedida.
- Motoristas: visualizam status atual e (se `rejected`) o `rejeitado_motivo`.

---

## Ordem de execução

1. Secrets do Gmail.
2. Migrations (alerts_dismissed, notifications_sent, audit_log, checklists.itens, requests.*).
3. Hooks (`useDismissedAlerts` reescrito, `useAuditLog` novo).
4. Edge Function `notify-alerts` + cron.
5. Página Financeiro + rota + menu.
6. Filtros de período + CSV nas 4 páginas.
7. KM final em Agendamentos.
8. Checklist por itens + atualização do `VeiculoChecklistStatus`.
9. Integração de `logAction` em Veiculos/Motoristas/Manutencoes/Multas + abas de Auditoria.
10. Fluxo de aprovação em Solicitações.

---

## Pontos a confirmar antes de implementar

1. **Permissão `financeiro**`: o spec diz que já existe em `ModuloPermissao` — vou confirmar lendo `src/lib/types.ts`. Se não existir, adiciono.
2. **Colunas reais** de `manutencoes`, `abastecimentos`, `multas`, `requests`, `perfis`: vou inspecionar o schema antes de escrever queries (nomes de campos como `valor`, `valor_total`, `tipo_conta` etc.).
3. **Cron via pg_cron**: requer `pg_net` + secret com a service role; configuro junto com a Edge Function.

Posso prosseguir com a implementação?