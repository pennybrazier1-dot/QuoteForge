-- Builder-suggested alternative on a booked job.
-- Does not replace planned_start_* / booking_confirmation until the customer accepts.
alter table public.proposals
  add column if not exists pending_date_suggestion jsonb;

comment on column public.proposals.pending_date_suggestion is
  'Builder-suggested alternative slot while a confirmed booking remains in planned_start_*. Cleared on accept, decline, or a new customer date request.';
