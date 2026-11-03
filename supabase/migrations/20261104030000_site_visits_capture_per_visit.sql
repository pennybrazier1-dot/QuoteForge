-- Milestone 5A / 6A — one capture session per visit (additive) + deny-by-default review table.
-- Preserves historical site_visits rows. Does not delete media.
-- After 20261104020000_visits_historical_backfill.sql.
--
-- Milestone 6A note: this file was never applied to the local app DB. Security for
-- site_visits_historical_review is included here (deny-by-default) rather than a
-- separate migration, so the first apply is already locked down.

-- Drop the old 1:1 enquiry capture constraint so follow-ups can have their own capture.
alter table public.site_visits
  drop constraint if exists site_visits_enquiry_id_key;

-- Some environments named the unique index explicitly.
drop index if exists public.site_visits_enquiry_id_key;

-- Keep enquiry relationship indexed (non-unique).
create index if not exists site_visits_workspace_enquiry_idx
  on public.site_visits (workspace_id, enquiry_id);

-- One capture row per booking visit when linked.
create unique index if not exists site_visits_visit_id_uidx
  on public.site_visits (visit_id)
  where visit_id is not null;

comment on column public.site_visits.visit_id is
  'Booking visit that owns this capture session. NULL means historical enquiry-level capture awaiting review/link.';

comment on table public.site_visits is
  'On-site capture sessions. Prefer one row per visits.id. Unlinked rows (visit_id null) are historical enquiry-level captures.';

-- Flag-style audit for remaining unlinked historical captures (server/audit only).
create table if not exists public.site_visits_historical_review (
  site_visit_id uuid primary key references public.site_visits (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  reason text not null default 'unlinked_enquiry_level_capture',
  noted_at timestamptz not null default now()
);

comment on table public.site_visits_historical_review is
  'Inventory of site_visits that remain enquiry-level (visit_id null) after capture-per-visit. Server/audit only — not client-exposed.';

alter table public.site_visits_historical_review enable row level security;
alter table public.site_visits_historical_review force row level security;

-- Deny-by-default for PostgREST client roles. service_role bypasses RLS.
revoke all on table public.site_visits_historical_review from anon;
revoke all on table public.site_visits_historical_review from authenticated;
grant all on table public.site_visits_historical_review to service_role;
grant all on table public.site_visits_historical_review to postgres;

insert into public.site_visits_historical_review (site_visit_id, workspace_id, enquiry_id, reason)
select sv.id, sv.workspace_id, sv.enquiry_id, 'unlinked_enquiry_level_capture'
from public.site_visits sv
where sv.visit_id is null
on conflict (site_visit_id) do nothing;
