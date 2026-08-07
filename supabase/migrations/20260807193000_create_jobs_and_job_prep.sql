-- Phase 50: Job lifecycle foundation after proposal acceptance.
-- Does not implement invoices — invoiced/paid statuses are reserved for later.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'accepted' check (
    status in (
      'accepted',
      'preparing',
      'scheduled',
      'in_progress',
      'completed',
      'invoiced',
      'paid'
    )
  ),
  accepted_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id)
);

create index if not exists jobs_workspace_id_idx
  on public.jobs (workspace_id, created_at desc);

create index if not exists jobs_workspace_status_idx
  on public.jobs (workspace_id, status);

create index if not exists jobs_customer_id_idx
  on public.jobs (customer_id);

create trigger set_jobs_updated_at
before update on public.jobs
for each row
execute function public.set_updated_at();

alter table public.jobs enable row level security;

create policy "Users can view jobs in their workspace"
  on public.jobs for select
  to authenticated
  using (workspace_id = public.current_workspace_id());

create policy "Users can create jobs in their workspace"
  on public.jobs for insert
  to authenticated
  with check (workspace_id = public.current_workspace_id());

create policy "Users can update jobs in their workspace"
  on public.jobs for update
  to authenticated
  using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

comment on table public.jobs is
  'Work orders created when a customer accepts a proposal. Proposal stays the quote record.';

-- ---------------------------------------------------------------------------
-- Job preparation checklist items
-- ---------------------------------------------------------------------------

create table if not exists public.job_prep_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  item_key text not null check (
    item_key in (
      'customer_details',
      'measurements',
      'site_visit',
      'materials',
      'access_requirements',
      'start_date'
    )
  ),
  status text not null default 'open' check (
    status in ('open', 'confirmed', 'not_needed')
  ),
  sort_order integer not null default 0,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, item_key)
);

create index if not exists job_prep_items_job_id_idx
  on public.job_prep_items (job_id, sort_order);

create index if not exists job_prep_items_workspace_id_idx
  on public.job_prep_items (workspace_id);

create trigger set_job_prep_items_updated_at
before update on public.job_prep_items
for each row
execute function public.set_updated_at();

alter table public.job_prep_items enable row level security;

create policy "Users can view job prep items in their workspace"
  on public.job_prep_items for select
  to authenticated
  using (workspace_id = public.current_workspace_id());

create policy "Users can create job prep items in their workspace"
  on public.job_prep_items for insert
  to authenticated
  with check (workspace_id = public.current_workspace_id());

create policy "Users can update job prep items in their workspace"
  on public.job_prep_items for update
  to authenticated
  using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

comment on table public.job_prep_items is
  'Preparation checklist for an accepted job before work is scheduled/started.';
