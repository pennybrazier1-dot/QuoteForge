-- Phase 2: Lead-to-quote data backbone
-- Enquiries, timeline, site visits, media metadata, public intake slug, storage bucket

-- ---------------------------------------------------------------------------
-- Workspaces: public enquiry intake slug
-- ---------------------------------------------------------------------------

alter table public.workspaces
  add column if not exists public_enquiry_slug text;

create unique index if not exists workspaces_public_enquiry_slug_uidx
  on public.workspaces (public_enquiry_slug)
  where public_enquiry_slug is not null;

comment on column public.workspaces.public_enquiry_slug is
  'Public token used in /request-quote/w/[slug]. Never expose private workspace fields via this slug.';

-- ---------------------------------------------------------------------------
-- Enquiries
-- ---------------------------------------------------------------------------

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'new' check (
    status in (
      'new',
      'reviewing',
      'site_visit_booked',
      'site_visit_completed',
      'quote_in_preparation',
      'declined'
    )
  ),
  received_at timestamptz not null default now(),
  service_requested text not null default '',
  customer_name text not null default '',
  customer_mobile text not null default '',
  customer_email text not null default '',
  address_line_1 text not null default '',
  address_line_2 text not null default '',
  town text not null default '',
  county text not null default '',
  postcode text not null default '',
  property_type text,
  project_description text not null default '',
  measurements jsonb not null default '[]'::jsonb,
  trade_answers jsonb not null default '[]'::jsonb,
  suggested_next_action text not null default '',
  linked_proposal_draft_id text,
  linked_proposal_id uuid references public.proposals(id) on delete set null,
  source text not null default 'request_quote',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index enquiries_workspace_received_idx
  on public.enquiries (workspace_id, received_at desc);
create index enquiries_workspace_status_idx
  on public.enquiries (workspace_id, status);
create index enquiries_customer_id_idx
  on public.enquiries (customer_id);

create trigger set_enquiries_updated_at
before update on public.enquiries
for each row
execute function public.set_updated_at();

alter table public.enquiries enable row level security;

create policy "Users can view enquiries in their workspace"
  on public.enquiries for select
  using (workspace_id = public.current_workspace_id());

create policy "Users can create enquiries in their workspace"
  on public.enquiries for insert
  with check (workspace_id = public.current_workspace_id());

create policy "Users can update enquiries in their workspace"
  on public.enquiries for update
  using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy "Users can delete enquiries in their workspace"
  on public.enquiries for delete
  using (workspace_id = public.current_workspace_id());

-- ---------------------------------------------------------------------------
-- Enquiry timeline events
-- ---------------------------------------------------------------------------

create table public.enquiry_timeline_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  label text not null,
  event_type text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index enquiry_timeline_enquiry_occurred_idx
  on public.enquiry_timeline_events (enquiry_id, occurred_at asc);
create index enquiry_timeline_workspace_occurred_idx
  on public.enquiry_timeline_events (workspace_id, occurred_at desc);

alter table public.enquiry_timeline_events enable row level security;

create policy "Users can view enquiry timeline in their workspace"
  on public.enquiry_timeline_events for select
  using (workspace_id = public.current_workspace_id());

create policy "Users can create enquiry timeline in their workspace"
  on public.enquiry_timeline_events for insert
  with check (workspace_id = public.current_workspace_id());

create policy "Users can delete enquiry timeline in their workspace"
  on public.enquiry_timeline_events for delete
  using (workspace_id = public.current_workspace_id());

-- ---------------------------------------------------------------------------
-- Site visits (booking + capture — calendar source of truth)
-- ---------------------------------------------------------------------------

create table public.site_visits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  slot_label text,
  starts_at timestamptz,
  date_iso date,
  started_at timestamptz,
  completed_at timestamptz,
  notes text not null default '',
  measurements jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  voice_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enquiry_id)
);

create index site_visits_workspace_starts_idx
  on public.site_visits (workspace_id, starts_at);
create index site_visits_workspace_date_idx
  on public.site_visits (workspace_id, date_iso);

create trigger set_site_visits_updated_at
before update on public.site_visits
for each row
execute function public.set_updated_at();

alter table public.site_visits enable row level security;

create policy "Users can view site visits in their workspace"
  on public.site_visits for select
  using (workspace_id = public.current_workspace_id());

create policy "Users can create site visits in their workspace"
  on public.site_visits for insert
  with check (workspace_id = public.current_workspace_id());

create policy "Users can update site visits in their workspace"
  on public.site_visits for update
  using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy "Users can delete site visits in their workspace"
  on public.site_visits for delete
  using (workspace_id = public.current_workspace_id());

-- ---------------------------------------------------------------------------
-- Enquiry / site-visit media metadata
-- ---------------------------------------------------------------------------

create table public.enquiry_media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  site_visit_id uuid references public.site_visits(id) on delete set null,
  kind text not null default 'photo' check (kind in ('photo', 'voice_note')),
  file_name text not null default '',
  mime_type text not null default 'application/octet-stream',
  byte_size bigint not null default 0 check (byte_size >= 0),
  storage_path text not null,
  captured_at timestamptz not null default now(),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index enquiry_media_enquiry_idx on public.enquiry_media (enquiry_id);
create index enquiry_media_site_visit_idx on public.enquiry_media (site_visit_id);
create index enquiry_media_workspace_idx on public.enquiry_media (workspace_id, enquiry_id);

alter table public.enquiry_media enable row level security;

create policy "Users can view enquiry media in their workspace"
  on public.enquiry_media for select
  using (workspace_id = public.current_workspace_id());

create policy "Users can create enquiry media in their workspace"
  on public.enquiry_media for insert
  with check (workspace_id = public.current_workspace_id());

create policy "Users can update enquiry media in their workspace"
  on public.enquiry_media for update
  using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy "Users can delete enquiry media in their workspace"
  on public.enquiry_media for delete
  using (workspace_id = public.current_workspace_id());

-- ---------------------------------------------------------------------------
-- Storage bucket (private)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-visit-photos',
  'site-visit-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path convention: {workspace_id}/{enquiry_id}/{site_visit_id|intake}/{media_id}.{ext}
create policy "Workspace members can read site visit photos"
  on storage.objects for select
  using (
    bucket_id = 'site-visit-photos'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy "Workspace members can upload site visit photos"
  on storage.objects for insert
  with check (
    bucket_id = 'site-visit-photos'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy "Workspace members can update site visit photos"
  on storage.objects for update
  using (
    bucket_id = 'site-visit-photos'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  )
  with check (
    bucket_id = 'site-visit-photos'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

create policy "Workspace members can delete site visit photos"
  on storage.objects for delete
  using (
    bucket_id = 'site-visit-photos'
    and (storage.foldername(name))[1] = public.current_workspace_id()::text
  );

-- ---------------------------------------------------------------------------
-- Public enquiry intake (security definer — no free-form workspace_id from clients)
-- ---------------------------------------------------------------------------

create or replace function public.submit_public_enquiry(
  p_slug text,
  p_customer_name text,
  p_customer_mobile text,
  p_customer_email text,
  p_service_requested text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_town text,
  p_county text,
  p_postcode text,
  p_property_type text,
  p_project_description text,
  p_measurements jsonb default '[]'::jsonb,
  p_trade_answers jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_enquiry_id uuid;
  v_now timestamptz := now();
begin
  if p_slug is null or length(trim(p_slug)) < 8 then
    raise exception 'Invalid enquiry link';
  end if;

  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'Customer name is required';
  end if;

  if (p_customer_mobile is null or length(trim(p_customer_mobile)) = 0)
     and (p_customer_email is null or length(trim(p_customer_email)) = 0) then
    raise exception 'A phone number or email is required';
  end if;

  select id into v_workspace_id
  from public.workspaces
  where public_enquiry_slug = lower(trim(p_slug))
  limit 1;

  if v_workspace_id is null then
    raise exception 'Invalid enquiry link';
  end if;

  insert into public.enquiries (
    workspace_id,
    status,
    received_at,
    service_requested,
    customer_name,
    customer_mobile,
    customer_email,
    address_line_1,
    address_line_2,
    town,
    county,
    postcode,
    property_type,
    project_description,
    measurements,
    trade_answers,
    suggested_next_action,
    source
  ) values (
    v_workspace_id,
    'new',
    v_now,
    coalesce(nullif(trim(p_service_requested), ''), 'Site visit work'),
    trim(p_customer_name),
    coalesce(trim(p_customer_mobile), ''),
    coalesce(trim(p_customer_email), ''),
    coalesce(trim(p_address_line_1), ''),
    coalesce(trim(p_address_line_2), ''),
    coalesce(trim(p_town), ''),
    coalesce(trim(p_county), ''),
    coalesce(trim(p_postcode), ''),
    nullif(trim(p_property_type), ''),
    coalesce(trim(p_project_description), ''),
    coalesce(p_measurements, '[]'::jsonb),
    coalesce(p_trade_answers, '[]'::jsonb),
    'Review the customer details and project description, then decide whether to book a site visit.',
    'request_quote'
  )
  returning id into v_enquiry_id;

  insert into public.enquiry_timeline_events (
    workspace_id,
    enquiry_id,
    label,
    event_type,
    occurred_at
  ) values (
    v_workspace_id,
    v_enquiry_id,
    'Enquiry received from ' || trim(p_customer_name) || '.',
    'enquiry_received',
    v_now
  );

  return v_enquiry_id;
end;
$$;

revoke all on function public.submit_public_enquiry(
  text, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb
) from public;

grant execute on function public.submit_public_enquiry(
  text, text, text, text, text, text, text, text, text, text, text, text, jsonb, jsonb
) to anon, authenticated;

create or replace function public.get_public_intake_workspace(p_slug text)
returns table (
  business_name text,
  phone text,
  trade_type text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_slug is null or length(trim(p_slug)) < 8 then
    return;
  end if;

  return query
  select w.business_name, w.phone, w.trade_type
  from public.workspaces w
  where w.public_enquiry_slug = lower(trim(p_slug))
  limit 1;
end;
$$;

revoke all on function public.get_public_intake_workspace(text) from public;
grant execute on function public.get_public_intake_workspace(text) to anon, authenticated;
