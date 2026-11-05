-- Stage 9I.3c Part 2 — Payment ledger foundation (LOCAL).
-- Append-only invoice_payments + opening_amount_paid snapshot.
-- Does NOT invent historical payment events.
-- record_invoice_payment is created but NOT granted to authenticated/service_role
-- until Part 3 rewires legacy direct-balance writers.

-- ---------------------------------------------------------------------------
-- 1) Proposal payment_status: add partially_paid
-- ---------------------------------------------------------------------------
alter table public.proposals
  drop constraint if exists proposals_payment_status_check;

alter table public.proposals
  add constraint proposals_payment_status_check
  check (
    payment_status = any (
      array[
        'not_requested'::text,
        'requested'::text,
        'partially_paid'::text,
        'paid'::text,
        'waived'::text
      ]
    )
  );

comment on column public.proposals.payment_status is
  'not_requested | requested | partially_paid | paid | waived. paid = fully settled.';

-- ---------------------------------------------------------------------------
-- 2) Opening balance column (snapshot filled after ledger table exists)
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column if not exists opening_amount_paid integer not null default 0;

alter table public.invoices
  drop constraint if exists invoices_opening_amount_paid_check;

alter table public.invoices
  add constraint invoices_opening_amount_paid_check
  check (opening_amount_paid >= 0);

comment on column public.invoices.opening_amount_paid is
  'Pre-ledger paid counter snapshot. amount_paid = opening_amount_paid + sum(ledger). Not a fabricated payment row.';

-- ---------------------------------------------------------------------------
-- 3) Ledger table
-- ---------------------------------------------------------------------------
create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  proposal_id uuid not null references public.proposals (id) on delete restrict,
  amount_pence integer not null,
  paid_on date not null default (timezone('utc', now()))::date,
  recorded_at timestamptz not null default now(),
  method text not null,
  reference text null,
  note text null,
  recorded_by uuid null references auth.users (id) on delete set null,
  idempotency_key text not null,
  is_legacy_marker boolean not null default false,
  created_at timestamptz not null default now(),
  constraint invoice_payments_amount_positive check (amount_pence > 0),
  constraint invoice_payments_method_check check (
    method = any (
      array[
        'bank_transfer'::text,
        'card_link'::text,
        'card_in_person'::text,
        'cash'::text,
        'other'::text
      ]
    )
  ),
  constraint invoice_payments_workspace_idempotency_key unique (workspace_id, idempotency_key)
);

create index if not exists invoice_payments_invoice_idx
  on public.invoice_payments (invoice_id, recorded_at);

create index if not exists invoice_payments_proposal_idx
  on public.invoice_payments (proposal_id, recorded_at);

create index if not exists invoice_payments_workspace_idx
  on public.invoice_payments (workspace_id, recorded_at desc);

comment on table public.invoice_payments is
  'Append-only payment ledger. Sum(amount_pence) + opening_amount_paid drives invoice counters.';

-- Block direct writes except when RPC sets a transaction-local flag.
create or replace function public.enforce_invoice_payments_rpc_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Updates and deletes are never allowed (including with the RPC flag).
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    raise exception 'invoice_payments is append-only';
  end if;
  -- Inserts only via record_invoice_payment (sets reanvil.record_invoice_payment=1).
  if current_setting('reanvil.record_invoice_payment', true) is distinct from '1' then
    raise exception 'invoice_payments may only be written via record_invoice_payment';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_invoice_payments_rpc_only on public.invoice_payments;
create trigger enforce_invoice_payments_rpc_only
  before insert or update or delete on public.invoice_payments
  for each row
  execute function public.enforce_invoice_payments_rpc_only();

-- ---------------------------------------------------------------------------
-- 4) Opening balance snapshot + legacy sync (ledger empty only)
-- Empty ledger must NOT imply unpaid when counters already show paid/partial.
-- ---------------------------------------------------------------------------
update public.invoices
set opening_amount_paid = amount_paid
where opening_amount_paid = 0
  and amount_paid > 0;

create or replace function public.sync_invoice_opening_amount_paid()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.amount_paid is distinct from old.amount_paid
     and not exists (
       select 1
       from public.invoice_payments p
       where p.invoice_id = new.id
         and p.is_legacy_marker = false
     )
  then
    new.opening_amount_paid := greatest(0, new.amount_paid);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_invoice_opening_amount_paid on public.invoices;
create trigger sync_invoice_opening_amount_paid
  before update of amount_paid on public.invoices
  for each row
  execute function public.sync_invoice_opening_amount_paid();

-- ---------------------------------------------------------------------------
-- 5) RLS — workspace read only for traders; no insert/update/delete policies
-- ---------------------------------------------------------------------------
alter table public.invoice_payments enable row level security;

revoke all on table public.invoice_payments from public, anon, authenticated, service_role;
grant select on table public.invoice_payments to authenticated;

drop policy if exists "Users can view invoice payments in their workspace"
  on public.invoice_payments;
create policy "Users can view invoice payments in their workspace"
  on public.invoice_payments
  for select
  to authenticated
  using (workspace_id = public.current_workspace_id());

-- ---------------------------------------------------------------------------
-- 6) Atomic RPC (EXECUTE withheld from app roles until Part 3)
-- ---------------------------------------------------------------------------
create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount_pence integer,
  p_method text,
  p_paid_on date,
  p_reference text default null,
  p_note text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_workspace_id uuid := public.current_workspace_id();
  v_invoice public.invoices%rowtype;
  v_proposal public.proposals%rowtype;
  v_key text;
  v_existing public.invoice_payments%rowtype;
  v_ledger_sum integer;
  v_new_paid integer;
  v_new_balance integer;
  v_payment_id uuid;
  v_proposal_payment_status text;
  v_job_status text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if v_workspace_id is null then
    raise exception 'Workspace not found';
  end if;

  if p_amount_pence is null or p_amount_pence <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  if p_method is null or p_method not in (
    'bank_transfer', 'card_link', 'card_in_person', 'cash', 'other'
  ) then
    raise exception 'Invalid payment method';
  end if;

  select *
    into v_invoice
  from public.invoices
  where id = p_invoice_id
    and workspace_id = v_workspace_id
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if v_invoice.status <> 'approved' then
    raise exception 'Only an approved invoice can record payment';
  end if;

  select *
    into v_proposal
  from public.proposals
  where id = v_invoice.proposal_id
    and workspace_id = v_workspace_id
  for update;

  if not found then
    raise exception 'Proposal not found';
  end if;

  if v_proposal.closed_at is not null then
    raise exception 'Closed jobs cannot record payment';
  end if;

  if v_proposal.payment_status = 'waived' then
    raise exception 'Waived payments cannot record payment';
  end if;

  v_key := nullif(trim(coalesce(p_idempotency_key, '')), '');
  if v_key is null then
    v_key := 'manual/' || v_invoice.id::text || '/' || gen_random_uuid()::text;
  end if;

  select *
    into v_existing
  from public.invoice_payments
  where workspace_id = v_workspace_id
    and idempotency_key = v_key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'already_recorded', true,
      'payment_id', v_existing.id,
      'invoice_id', v_invoice.id,
      'amount_paid', v_invoice.amount_paid,
      'balance_due', v_invoice.balance_due,
      'fully_settled', (v_invoice.balance_due = 0),
      'proposal_payment_status', v_proposal.payment_status
    );
  end if;

  if v_invoice.balance_due <= 0 then
    raise exception 'Invoice is already fully paid';
  end if;

  if p_amount_pence > v_invoice.balance_due then
    raise exception 'Payment would exceed balance due (% pence remaining)',
      v_invoice.balance_due;
  end if;

  perform set_config('reanvil.record_invoice_payment', '1', true);

  insert into public.invoice_payments (
    workspace_id,
    invoice_id,
    proposal_id,
    amount_pence,
    paid_on,
    method,
    reference,
    note,
    recorded_by,
    idempotency_key,
    is_legacy_marker
  ) values (
    v_workspace_id,
    v_invoice.id,
    v_invoice.proposal_id,
    p_amount_pence,
    coalesce(p_paid_on, (timezone('utc', now()))::date),
    p_method,
    nullif(trim(coalesce(p_reference, '')), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    v_uid,
    v_key,
    false
  )
  returning id into v_payment_id;

  select coalesce(sum(amount_pence), 0)
    into v_ledger_sum
  from public.invoice_payments
  where invoice_id = v_invoice.id
    and workspace_id = v_workspace_id
    and is_legacy_marker = false;

  -- opening_amount_paid + ledger; never invents history; never changes total/VAT
  v_new_paid := least(
    v_invoice.total_amount,
    greatest(0, coalesce(v_invoice.opening_amount_paid, 0) + v_ledger_sum)
  );
  v_new_balance := greatest(0, v_invoice.total_amount - v_new_paid);

  update public.invoices
  set
    amount_paid = v_new_paid,
    balance_due = v_new_balance,
    updated_at = now()
  where id = v_invoice.id
    and workspace_id = v_workspace_id
    and status = 'approved';

  if v_new_balance = 0 then
    v_proposal_payment_status := 'paid';
    v_job_status := 'paid';
  else
    v_proposal_payment_status := 'partially_paid';
    v_job_status := 'invoiced';
  end if;

  update public.proposals
  set
    payment_status = v_proposal_payment_status,
    paid_at = case
      when v_new_balance = 0 then coalesce(paid_at, now())
      else paid_at
    end,
    payment_method = case
      when v_new_balance = 0 then p_method
      else payment_method
    end,
    updated_at = now()
  where id = v_invoice.proposal_id
    and workspace_id = v_workspace_id
    and closed_at is null
    and payment_status is distinct from 'waived';

  -- Paid ≠ closed. Never set proposals.status = closed here.
  update public.jobs
  set
    status = v_job_status,
    updated_at = now()
  where proposal_id = v_invoice.proposal_id
    and workspace_id = v_workspace_id
    and (
      v_new_balance = 0
      or status is distinct from 'paid'
    );

  return jsonb_build_object(
    'ok', true,
    'already_recorded', false,
    'payment_id', v_payment_id,
    'invoice_id', v_invoice.id,
    'amount_recorded', p_amount_pence,
    'amount_paid', v_new_paid,
    'balance_due', v_new_balance,
    'fully_settled', (v_new_balance = 0),
    'proposal_payment_status', v_proposal_payment_status,
    'job_status', v_job_status
  );
end;
$$;

revoke all on function public.record_invoice_payment(uuid, integer, text, date, text, text, text)
  from public, anon, authenticated, service_role;

comment on function public.record_invoice_payment is
  '9I.3c Part 2: atomic ledger payment. EXECUTE withheld from app roles until Part 3 rewires legacy writers. Never closes jobs. No notifications.';
