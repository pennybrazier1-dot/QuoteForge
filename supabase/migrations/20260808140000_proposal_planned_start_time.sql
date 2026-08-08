-- Phase 50C: exact start time for calendar scheduling workspace.

alter table public.proposals
add column if not exists planned_start_time text;

comment on column public.proposals.planned_start_time is
  'Optional start time HH:MM (24h) for scheduled jobs. Used by Calendar scheduling workspace.';
