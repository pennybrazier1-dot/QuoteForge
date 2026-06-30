-- QuoteForge database foundation:
-- - UUID generation
-- - updated_at trigger helper
-- - workspaces (the business)
-- - profiles (people inside a workspace)
-- - current_workspace_id() RLS helper (after profiles exists)
-- - Row Level Security

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  business_name text not null,
  contact_email text,
  phone text,
  address_line_1 text,
  address_line_2 text,
  town text,
  county text,
  postcode text,
  country text not null default 'United Kingdom',
  vat_number text,
  default_payment_terms text not null default 'Payment due within 7 days of acceptance unless otherwise agreed.',
  proposal_number_prefix text not null default 'QF',
  next_proposal_number integer not null default 1 check (next_proposal_number > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- v1: one founding workspace per auth user. Onboarding creates this once after signup.
create unique index workspaces_owner_id_unique_idx on public.workspaces(owner_id);

create index workspaces_owner_id_idx on public.workspaces(owner_id);

create trigger set_workspaces_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  full_name text,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_workspace_id_idx on public.profiles(workspace_id);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- Returns the workspace_id for the currently authenticated user.
create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.profiles where id = auth.uid()
$$;

comment on function public.current_workspace_id() is
  'Used by RLS policies to scope data to the logged-in user''s workspace.';

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;

create policy "Users can view their workspace"
on public.workspaces
for select
to authenticated
using (id = public.current_workspace_id());

create policy "Users can create their own workspace"
on public.workspaces
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Users can update their workspace"
on public.workspaces
for update
to authenticated
using (id = public.current_workspace_id())
with check (id = public.current_workspace_id());

create policy "Users can delete their own workspace"
on public.workspaces
for delete
to authenticated
using (owner_id = auth.uid());

create policy "Users can view profiles in their workspace"
on public.profiles
for select
to authenticated
using (workspace_id = public.current_workspace_id());

create policy "Users can create their own profile during onboarding"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and exists (
    select 1
    from public.workspaces
    where workspaces.id = profiles.workspace_id
      and workspaces.owner_id = auth.uid()
  )
);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and workspace_id = public.current_workspace_id()
);
