-- Phase 50D: Standalone visits (initial assessment / site assessment).
-- Separate from enquiry-bound site_visits — no proposal/quote required.

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  enquiry_id uuid references public.enquiries(id) on delete set null,

  customer_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  address_line_1 text not null default '',
  address_line_2 text not null default '',
  town text not null default '',
  county text not null default '',
  postcode text not null default '',

  enquiry_summary text not null default '',
  visit_type text not null check (
    visit_type in (
      'initial_assessment',
      'measure_up',
      'follow_up',
      'final_inspection'
    )
  ),
  visit_date date not null,
  visit_time text,
  duration_minutes integer not null default 60
    check (duration_minutes > 0 and duration_minutes <= 24 * 60),
  status text not null default 'scheduled' check (
    status in (
      'scheduled',
      'confirmed',
      'completed',
      'cancelled',
      'no_show'
    )
  ),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visits_workspace_date_idx
  on public.visits (workspace_id, visit_date desc);

create index if not exists visits_workspace_status_idx
  on public.visits (workspace_id, status);

create index if not exists visits_customer_id_idx
  on public.visits (customer_id);

create index if not exists visits_enquiry_id_idx
  on public.visits (enquiry_id);

comment on table public.visits is
  'Standalone site visits arranged before a quote exists. Not tied to proposals.';

create trigger set_visits_updated_at
before update on public.visits
for each row
execute function public.set_updated_at();

alter table public.visits enable row level security;

create policy "Users can view visits in their workspace"
  on public.visits for select
  using (workspace_id = public.current_workspace_id());

create policy "Users can create visits in their workspace"
  on public.visits for insert
  with check (workspace_id = public.current_workspace_id());

create policy "Users can update visits in their workspace"
  on public.visits for update
  using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

create policy "Users can delete visits in their workspace"
  on public.visits for delete
  using (workspace_id = public.current_workspace_id());
