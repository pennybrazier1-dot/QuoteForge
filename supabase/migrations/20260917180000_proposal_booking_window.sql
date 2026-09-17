alter table public.proposals
  add column if not exists booking_window jsonb;

comment on column public.proposals.booking_window is
  'Trader-chosen period used to search customer-facing availability. Never shown as diary details.';
