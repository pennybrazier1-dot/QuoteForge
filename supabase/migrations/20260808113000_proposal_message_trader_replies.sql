-- Phase 50B.1.5a: proposal conversation supports trader replies.

alter table public.proposal_customer_messages
  drop constraint if exists proposal_customer_messages_kind_check;

alter table public.proposal_customer_messages
  add constraint proposal_customer_messages_kind_check
  check (
    kind in (
      'question',
      'change_request',
      'accept_note',
      'trader_reply'
    )
  );

alter table public.proposal_customer_messages
  add column if not exists direction text;

update public.proposal_customer_messages
set direction = 'customer'
where direction is null;

alter table public.proposal_customer_messages
  alter column direction set default 'customer';

alter table public.proposal_customer_messages
  alter column direction set not null;

alter table public.proposal_customer_messages
  drop constraint if exists proposal_customer_messages_direction_check;

alter table public.proposal_customer_messages
  add constraint proposal_customer_messages_direction_check
  check (direction in ('customer', 'trader'));

alter table public.proposal_customer_messages
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists proposal_customer_messages_direction_idx
  on public.proposal_customer_messages (proposal_id, direction, created_at desc);

-- Traders can post replies inside their workspace (customers still use service role).
create policy "Users can insert trader replies in their workspace"
on public.proposal_customer_messages
for insert
to authenticated
with check (
  workspace_id = public.current_workspace_id()
  and direction = 'trader'
  and kind = 'trader_reply'
);

comment on table public.proposal_customer_messages is
  'Proposal conversation messages — customer portal messages and trader replies.';

comment on column public.proposal_customer_messages.direction is
  'Who authored the message: customer or trader.';

comment on column public.proposal_customer_messages.created_by is
  'Auth user for trader replies; null for customer portal messages.';
