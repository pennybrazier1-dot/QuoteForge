-- Proposal lifecycle: waiting_for_customer, booked, in_progress, completed
-- Migrate legacy "sent" rows to waiting_for_customer.

alter table public.proposals
  add column if not exists booked_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

comment on column public.proposals.booked_at is
  'When the tradesperson confirmed the start date and booked the job.';
comment on column public.proposals.started_at is
  'When work started (manual start or automatic on booked start date).';
comment on column public.proposals.completed_at is
  'When the tradesperson marked the job complete.';

update public.proposals
set status = 'waiting_for_customer'
where status = 'sent';

alter table public.proposals
drop constraint if exists proposals_status_check;

alter table public.proposals
add constraint proposals_status_check
check (
  status in (
    'draft',
    'ready_to_send',
    'waiting_for_customer',
    'accepted',
    'booked',
    'in_progress',
    'completed',
    'cancelled',
    'declined',
    'expired'
  )
);
