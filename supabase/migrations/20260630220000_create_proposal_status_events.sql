-- Proposal status and activity events for timeline and audit trail.

create table public.proposal_status_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  event_type text not null check (
    event_type in ('status_change', 'emailed', 'viewed', 'reminder')
  ),
  from_status text,
  to_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index proposal_status_events_proposal_id_idx
  on public.proposal_status_events(proposal_id, created_at desc);

create index proposal_status_events_workspace_id_idx
  on public.proposal_status_events(workspace_id, created_at desc);

alter table public.proposal_status_events enable row level security;

create policy "Users can view proposal events in their workspace"
on public.proposal_status_events
for select
to authenticated
using (workspace_id = public.current_workspace_id());

create policy "Users can create proposal events in their workspace"
on public.proposal_status_events
for insert
to authenticated
with check (
  workspace_id = public.current_workspace_id()
  and created_by = auth.uid()
  and proposal_id in (
    select proposals.id
    from public.proposals
    where proposals.workspace_id = proposal_status_events.workspace_id
  )
);
