-- Customer proposal portal: secure token access + customer messages.

alter table public.proposals
  add column if not exists customer_access_token text;

create unique index if not exists proposals_customer_access_token_uidx
  on public.proposals (customer_access_token)
  where customer_access_token is not null;

comment on column public.proposals.customer_access_token is
  'Opaque token for unauthenticated customer proposal portal access (/p/{token}).';

-- Allow customer-originated timeline events without an auth user.
alter table public.proposal_status_events
  alter column created_by drop not null;

create table if not exists public.proposal_customer_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  kind text not null check (
    kind in ('question', 'change_request', 'accept_note')
  ),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists proposal_customer_messages_proposal_id_idx
  on public.proposal_customer_messages (proposal_id, created_at desc);

create index if not exists proposal_customer_messages_workspace_id_idx
  on public.proposal_customer_messages (workspace_id, created_at desc);

alter table public.proposal_customer_messages enable row level security;

create policy "Users can view proposal customer messages in their workspace"
on public.proposal_customer_messages
for select
to authenticated
using (workspace_id = public.current_workspace_id());

comment on table public.proposal_customer_messages is
  'Messages submitted by customers via the secure proposal portal.';
