-- Add ready_to_send to the proposal status workflow.

alter table public.proposals
drop constraint if exists proposals_status_check;

alter table public.proposals
add constraint proposals_status_check
check (
  status in (
    'draft',
    'ready_to_send',
    'sent',
    'accepted',
    'declined',
    'expired'
  )
);
