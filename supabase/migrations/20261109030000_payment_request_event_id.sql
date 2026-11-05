-- Stage 9L.4 Part 2U-bis: durable payment-request notification identity.
-- Keeps payment_requested_at as display/audit timestamp only.
-- Outbound key: payment_requested/{proposal_id}/{payment_request_event_id}.
-- Additive only. No RLS/policy changes (workspace update policies already cover proposals).

alter table public.proposals
  add column if not exists payment_request_event_id text;

comment on column public.proposals.payment_request_event_id is
  'Stable idempotency identity for the current payment-request customer notification. '
  'Written on authorised requestJobPayment; reused for same logical request retries; '
  'replaced when a new authorised request is issued. '
  'Outbound key: payment_requested/{proposal_id}/{payment_request_event_id}. '
  'Distinct from payment_requested_at (display/audit timestamp).';

alter table public.proposals
  drop constraint if exists proposals_payment_request_event_id_len;

alter table public.proposals
  add constraint proposals_payment_request_event_id_len
  check (
    payment_request_event_id is null
    or (
      char_length(payment_request_event_id) >= 8
      and char_length(payment_request_event_id) <= 128
    )
  );
