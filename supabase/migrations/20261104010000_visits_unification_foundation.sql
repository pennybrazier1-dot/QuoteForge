-- Unified site visits — Milestone 1 foundation (additive only).
-- Does not drop visits or site_visits. Does not rewrite historical rows.
-- After Stage 2 migration set (latest: 20261103081000).

-- ---------------------------------------------------------------------------
-- visits: public confirmation token + canonical datetime + capture link
-- ---------------------------------------------------------------------------

alter table public.visits
  add column if not exists customer_access_token text,
  add column if not exists starts_at timestamptz,
  add column if not exists slot_label text,
  add column if not exists source_site_visit_id uuid
    references public.site_visits (id) on delete set null;

comment on column public.visits.customer_access_token is
  'Opaque unguessable token for /v/[token] customer confirmation. Never use visit id as the public credential.';

comment on column public.visits.starts_at is
  'Canonical visit start for confirmation and calendar alignment.';

comment on column public.visits.slot_label is
  'Human-readable visit when label for customer-facing copy.';

comment on column public.visits.source_site_visit_id is
  'Optional link to a legacy site_visits capture row after backfill (Milestone 2+).';

create unique index if not exists visits_customer_access_token_uidx
  on public.visits (customer_access_token)
  where customer_access_token is not null;

create index if not exists visits_workspace_starts_at_idx
  on public.visits (workspace_id, starts_at);

create index if not exists visits_source_site_visit_id_idx
  on public.visits (source_site_visit_id)
  where source_site_visit_id is not null;

-- ---------------------------------------------------------------------------
-- site_visits: link capture session to visits SOT (nullable for legacy rows)
-- ---------------------------------------------------------------------------

alter table public.site_visits
  add column if not exists visit_id uuid
    references public.visits (id) on delete set null;

comment on column public.site_visits.visit_id is
  'Booking record in public.visits that owns this capture session.';

create unique index if not exists site_visits_visit_id_uidx
  on public.site_visits (visit_id)
  where visit_id is not null;

-- ---------------------------------------------------------------------------
-- Active initial visit uniqueness
-- Fails loudly if historical duplicates exist — never deletes or merges here.
-- Planned historical backfill must link-or-skip; it must not insert a second
-- active initial_assessment for an enquiry that already has one.
-- ---------------------------------------------------------------------------

do $$
declare
  duplicate_count integer;
  sample_enquiry text;
begin
  select count(*)::integer, min(enquiry_id::text)
  into duplicate_count, sample_enquiry
  from (
    select enquiry_id
    from public.visits
    where enquiry_id is not null
      and visit_type = 'initial_assessment'
      and status not in ('cancelled', 'no_show')
    group by enquiry_id
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception
      'visits_one_active_initial_per_enquiry cannot be created: % enquir(y/ies) already have multiple active initial_assessment visits (example enquiry_id=%). Resolve duplicates before applying this index. No data was deleted.',
      duplicate_count,
      sample_enquiry;
  end if;
end $$;

create unique index if not exists visits_one_active_initial_per_enquiry
  on public.visits (enquiry_id)
  where enquiry_id is not null
    and visit_type = 'initial_assessment'
    and status not in ('cancelled', 'no_show');
