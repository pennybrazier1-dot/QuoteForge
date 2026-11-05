-- Stage 9I.3c Part 3 — Safe payment writer cutover (LOCAL).
-- 1) Harden record_invoice_payment for concurrent idempotent retries.
-- 2) Block direct approved-invoice balance writes outside the RPC.
-- 3) Grant EXECUTE to authenticated only (no ledger INSERT/UPDATE/DELETE).

-- ---------------------------------------------------------------------------
-- 1) Replace RPC with unique_violation-safe idempotency
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

  begin
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
  exception
    when unique_violation then
      select *
        into v_existing
      from public.invoice_payments
      where workspace_id = v_workspace_id
        and idempotency_key = v_key;
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
  end;

  select coalesce(sum(amount_pence), 0)
    into v_ledger_sum
  from public.invoice_payments
  where invoice_id = v_invoice.id
    and workspace_id = v_workspace_id
    and is_legacy_marker = false;

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

comment on function public.record_invoice_payment is
  '9I.3c Part 3: atomic ledger payment for Mark as Paid / remaining balance. Never closes jobs. No notifications.';

-- ---------------------------------------------------------------------------
-- 2) Approved invoices: balances only via RPC flag
-- ---------------------------------------------------------------------------
create or replace function public.prevent_direct_approved_invoice_balance_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'approved'
     and new.status = 'approved'
     and (
       new.amount_paid is distinct from old.amount_paid
       or new.balance_due is distinct from old.balance_due
     )
     and current_setting('reanvil.record_invoice_payment', true) is distinct from '1'
  then
    raise exception 'Invoice balances may only be updated via record_invoice_payment';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_direct_approved_invoice_balance_write on public.invoices;
create trigger prevent_direct_approved_invoice_balance_write
  before update of amount_paid, balance_due on public.invoices
  for each row
  execute function public.prevent_direct_approved_invoice_balance_write();

-- ---------------------------------------------------------------------------
-- 3) Minimum app EXECUTE; still no ledger write grants
-- ---------------------------------------------------------------------------
revoke all on function public.record_invoice_payment(uuid, integer, text, date, text, text, text)
  from public, anon, service_role;
grant execute on function public.record_invoice_payment(uuid, integer, text, date, text, text, text)
  to authenticated;

revoke insert, update, delete on table public.invoice_payments from public, anon, authenticated, service_role;
grant select on table public.invoice_payments to authenticated;
-- Server-side reads (no write): service_role may SELECT only.
grant select on table public.invoice_payments to service_role;
