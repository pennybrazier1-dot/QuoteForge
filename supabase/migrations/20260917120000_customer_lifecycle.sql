-- Phase 50G.2: customer lifecycle
-- Active customers are people whose work became real, plus anyone added by the trader.
-- Archive and deletion use dedicated timestamps instead of overloaded status strings.

alter table public.customers
  add column if not exists activated_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz,
  add column if not exists anonymised_at timestamptz;

comment on column public.customers.activated_at is
  'Set when the person becomes a real customer: accepted work with a job/booking, or a trader adds them.';
comment on column public.customers.archived_at is
  'When set, the customer is hidden from the Active list. History stays linked.';
comment on column public.customers.deletion_requested_at is
  'Trader asked to delete this customer. Permanent removal waits until deletion_scheduled_for.';
comment on column public.customers.deletion_scheduled_for is
  'Earliest time a scheduled cleanup may permanently delete or anonymise this customer.';
comment on column public.customers.anonymised_at is
  'PII removed because linked jobs/proposals/history must be kept.';

create index if not exists customers_workspace_lifecycle_idx
  on public.customers (
    workspace_id,
    activated_at,
    archived_at,
    deletion_requested_at
  );

-- Existing quote-only contacts stay inactive.
-- People who already have accepted/booked work or a job become active customers.
update public.customers as customer
set activated_at = coalesce(customer.created_at, now())
where customer.activated_at is null
  and (
    exists (
      select 1
      from public.proposals as proposal
      where proposal.customer_id = customer.id
        and (
          proposal.accepted_at is not null
          or proposal.status in ('booked', 'completed')
        )
    )
    or exists (
      select 1
      from public.jobs as job
      where job.customer_id = customer.id
    )
  );
