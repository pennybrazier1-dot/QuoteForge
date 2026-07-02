-- Add cancelled proposal status and rearranged timeline event type.

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
    'expired',
    'cancelled'
  )
);

alter table public.proposal_status_events
drop constraint if exists proposal_status_events_event_type_check;

alter table public.proposal_status_events
add constraint proposal_status_events_event_type_check
check (
  event_type in (
    'status_change',
    'emailed',
    'viewed',
    'reminder',
    'rearranged'
  )
);
