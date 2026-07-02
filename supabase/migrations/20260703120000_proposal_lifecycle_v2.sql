-- Lifecycle v2: needs_attention, booking confirmation, reserved invoiced/paid.
-- Migrate accepted/in_progress into booked.

alter table public.proposals
  add column if not exists attention_reason text,
  add column if not exists booking_confirmation text;

comment on column public.proposals.attention_reason is
  'Why the tradesperson must respond (customer question, changes, date change).';
comment on column public.proposals.booking_confirmation is
  'provisional = holding the date (amber). confirmed = firm booking (green).';

-- accepted → booked provisional
update public.proposals
set
  status = 'booked',
  booking_confirmation = 'provisional',
  booked_at = coalesce(booked_at, accepted_at, updated_at, created_at)
where status = 'accepted';

-- in_progress → booked confirmed
update public.proposals
set
  status = 'booked',
  booking_confirmation = 'confirmed',
  booked_at = coalesce(booked_at, started_at, updated_at, created_at)
where status = 'in_progress';

alter table public.proposals
drop constraint if exists proposals_status_check;

alter table public.proposals
drop constraint if exists proposals_booking_confirmation_check;

alter table public.proposals
add constraint proposals_booking_confirmation_check
check (
  booking_confirmation is null
  or booking_confirmation in ('provisional', 'confirmed')
);

alter table public.proposals
add constraint proposals_status_check
check (
  status in (
    'draft',
    'ready_to_send',
    'waiting_for_customer',
    'needs_attention',
    'booked',
    'completed',
    'cancelled',
    'invoiced',
    'paid',
    'declined',
    'expired'
  )
);
