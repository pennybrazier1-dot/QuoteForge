-- Stage 9G.1: central outbound_messages foundation.
-- Delivery mutations go through SECURITY DEFINER RPCs only.
-- Authenticated workspace members may SELECT their own rows; anon has no access.
-- Does not alter invoices immutability or existing booking/issue columns.

create table if not exists public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  event_kind text not null
    check (event_kind in (
      'enquiry_received',
      'quote_accepted',
      'quote_declined',
      'customer_message',
      'trader_reply',
      'payment_requested',
      'payment_received',
      'invoice_issued',
      'visit_rescheduled',
      'visit_cancelled'
    )),
  audience text not null check (audience in ('trader', 'customer')),

  source_type text not null check (source_type in (
    'enquiry',
    'proposal',
    'proposal_customer_message',
    'visit',
    'invoice',
    'proposal_payment'
  )),
  source_id uuid not null,

  proposal_id uuid references public.proposals(id) on delete set null,
  enquiry_id uuid references public.enquiries(id) on delete set null,
  visit_id uuid references public.visits(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,

  recipient_email text not null,
  subject text,

  -- provider_accepted means Resend accepted the API call (message id returned).
  -- It does NOT mean the customer inbox received or opened the email.
  status text not null default 'needed'
    check (status in (
      'needed',
      'sending',
      'provider_accepted',
      'failed',
      'unknown',
      'simulated'
    )),
  provider text check (provider is null or provider in ('resend', 'simulated')),
  provider_message_id text,
  attempt_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,

  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (workspace_id, idempotency_key)
);

comment on table public.outbound_messages is
  'Stage 9G outbound notification attempts. provider_accepted ≠ inbox delivery.';

comment on column public.outbound_messages.status is
  'needed|sending|provider_accepted|failed|unknown|simulated. unknown must not blind-resend.';

comment on column public.outbound_messages.idempotency_key is
  'Stable business key for dedupe; also used as Resend Idempotency-Key (≤256 chars).';

create index if not exists outbound_messages_workspace_status_idx
  on public.outbound_messages (workspace_id, status, created_at desc);

create index if not exists outbound_messages_proposal_idx
  on public.outbound_messages (proposal_id)
  where proposal_id is not null;

create index if not exists outbound_messages_enquiry_idx
  on public.outbound_messages (enquiry_id)
  where enquiry_id is not null;

create index if not exists outbound_messages_visit_idx
  on public.outbound_messages (visit_id)
  where visit_id is not null;

create index if not exists outbound_messages_invoice_idx
  on public.outbound_messages (invoice_id)
  where invoice_id is not null;

create index if not exists outbound_messages_sending_attempt_idx
  on public.outbound_messages (status, attempt_at)
  where status = 'sending';

drop trigger if exists set_outbound_messages_updated_at on public.outbound_messages;
create trigger set_outbound_messages_updated_at
before update on public.outbound_messages
for each row
execute function public.set_updated_at();

alter table public.outbound_messages enable row level security;

revoke all on table public.outbound_messages from public, anon;
grant select on table public.outbound_messages to authenticated;
-- No insert/update/delete for authenticated — mutations via RPCs only.
revoke insert, update, delete on table public.outbound_messages from authenticated;
grant all on table public.outbound_messages to service_role;

drop policy if exists "Users can view outbound messages in their workspace"
  on public.outbound_messages;
create policy "Users can view outbound messages in their workspace"
  on public.outbound_messages for select
  to authenticated
  using (workspace_id = public.current_workspace_id());

-- ---------------------------------------------------------------------------
-- Authorisation helper for outbound RPCs
-- ---------------------------------------------------------------------------
create or replace function public.assert_outbound_workspace_access(p_workspace_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  jwt_role text := coalesce(
    nullif(auth.role(), ''),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  );
begin
  -- PostgREST service role (and local tests that set request.jwt.claim.role).
  if jwt_role = 'service_role' then
    return;
  end if;
  if public.current_workspace_id() is null
     or public.current_workspace_id() is distinct from p_workspace_id then
    raise exception 'Not authorised for outbound messages in this workspace';
  end if;
end;
$$;

revoke all on function public.assert_outbound_workspace_access(uuid) from public, anon;
grant execute on function public.assert_outbound_workspace_access(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enqueue (idempotent insert)
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_outbound_message(
  p_workspace_id uuid,
  p_event_kind text,
  p_audience text,
  p_source_type text,
  p_source_id uuid,
  p_recipient_email text,
  p_idempotency_key text,
  p_subject text default null,
  p_proposal_id uuid default null,
  p_enquiry_id uuid default null,
  p_visit_id uuid default null,
  p_invoice_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.outbound_messages%rowtype;
  inserted public.outbound_messages%rowtype;
  recipient text := lower(trim(coalesce(p_recipient_email, '')));
  key text := trim(coalesce(p_idempotency_key, ''));
begin
  perform public.assert_outbound_workspace_access(p_workspace_id);

  if recipient = '' or position('@' in recipient) = 0 then
    raise exception 'Recipient email is required';
  end if;
  if key = '' or char_length(key) > 256 then
    raise exception 'Idempotency key must be 1–256 characters';
  end if;

  select * into existing
  from public.outbound_messages
  where workspace_id = p_workspace_id
    and idempotency_key = key;

  if found then
    return jsonb_build_object(
      'ok', true,
      'created', false,
      'id', existing.id,
      'status', existing.status
    );
  end if;

  insert into public.outbound_messages (
    workspace_id,
    event_kind,
    audience,
    source_type,
    source_id,
    proposal_id,
    enquiry_id,
    visit_id,
    invoice_id,
    recipient_email,
    subject,
    status,
    idempotency_key,
    metadata
  ) values (
    p_workspace_id,
    p_event_kind,
    p_audience,
    p_source_type,
    p_source_id,
    p_proposal_id,
    p_enquiry_id,
    p_visit_id,
    p_invoice_id,
    recipient,
    nullif(trim(coalesce(p_subject, '')), ''),
    'needed',
    key,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into inserted;

  return jsonb_build_object(
    'ok', true,
    'created', true,
    'id', inserted.id,
    'status', inserted.status
  );
exception
  when unique_violation then
    select * into existing
    from public.outbound_messages
    where workspace_id = p_workspace_id
      and idempotency_key = key;
    return jsonb_build_object(
      'ok', true,
      'created', false,
      'id', existing.id,
      'status', existing.status
    );
end;
$$;

revoke all on function public.enqueue_outbound_message(
  uuid, text, text, text, uuid, text, text, text, uuid, uuid, uuid, uuid, jsonb
) from public, anon;
grant execute on function public.enqueue_outbound_message(
  uuid, text, text, text, uuid, text, text, text, uuid, uuid, uuid, uuid, jsonb
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- CAS claim: needed|failed → sending
-- ---------------------------------------------------------------------------
create or replace function public.claim_outbound_message(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.outbound_messages%rowtype;
  claimed public.outbound_messages%rowtype;
begin
  select * into current_row
  from public.outbound_messages
  where id = p_message_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Outbound message not found.');
  end if;

  perform public.assert_outbound_workspace_access(current_row.workspace_id);

  if current_row.status in ('provider_accepted', 'simulated') then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Notification was already accepted by the provider (or simulated).',
      'status', current_row.status,
      'provider_message_id', current_row.provider_message_id
    );
  end if;

  if current_row.status = 'sending' then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Another send attempt is already in progress for this notification.',
      'status', 'sending',
      'attempt_at', current_row.attempt_at
    );
  end if;

  if current_row.status = 'unknown' then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Delivery outcome is unsettled. Confirm the provider message id without resending.',
      'status', 'unknown',
      'provider_message_id', current_row.provider_message_id,
      'attempt_at', current_row.attempt_at
    );
  end if;

  if current_row.status not in ('needed', 'failed') then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Notification cannot be claimed in its current state.',
      'status', current_row.status
    );
  end if;

  update public.outbound_messages
  set
    status = 'sending',
    attempt_at = now(),
    attempt_count = attempt_count + 1,
    provider = null,
    provider_message_id = null,
    last_error = null
  where id = p_message_id
    and status in ('needed', 'failed')
  returning * into claimed;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Could not claim this notification (concurrent update).'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', claimed.id,
    'status', claimed.status,
    'attempt_count', claimed.attempt_count,
    'idempotency_key', claimed.idempotency_key,
    'recipient_email', claimed.recipient_email,
    'subject', claimed.subject,
    'event_kind', claimed.event_kind,
    'audience', claimed.audience,
    'workspace_id', claimed.workspace_id
  );
end;
$$;

revoke all on function public.claim_outbound_message(uuid) from public, anon;
grant execute on function public.claim_outbound_message(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Settle after provider attempt (only from sending)
-- ---------------------------------------------------------------------------
create or replace function public.settle_outbound_message(
  p_message_id uuid,
  p_status text,
  p_provider text default null,
  p_provider_message_id text default null,
  p_last_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.outbound_messages%rowtype;
  updated public.outbound_messages%rowtype;
begin
  if p_status not in ('provider_accepted', 'failed', 'unknown', 'simulated') then
    raise exception 'Invalid settle status';
  end if;
  if p_status = 'provider_accepted'
     and nullif(trim(coalesce(p_provider_message_id, '')), '') is null then
    raise exception 'provider_accepted requires a provider message id';
  end if;

  select * into current_row
  from public.outbound_messages
  where id = p_message_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Outbound message not found.');
  end if;

  perform public.assert_outbound_workspace_access(current_row.workspace_id);

  if current_row.status is distinct from 'sending' then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Only in-flight (sending) notifications can be settled.',
      'status', current_row.status
    );
  end if;

  update public.outbound_messages
  set
    status = p_status,
    provider = nullif(trim(coalesce(p_provider, '')), ''),
    provider_message_id = nullif(trim(coalesce(p_provider_message_id, '')), ''),
    last_error = nullif(trim(coalesce(p_last_error, '')), ''),
    attempt_at = now()
  where id = p_message_id
    and status = 'sending'
  returning * into updated;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Could not settle this notification (concurrent update).'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', updated.id,
    'status', updated.status,
    'provider_message_id', updated.provider_message_id
  );
end;
$$;

revoke all on function public.settle_outbound_message(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.settle_outbound_message(uuid, text, text, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Confirm provider acceptance without resending (unknown → provider_accepted)
-- ---------------------------------------------------------------------------
create or replace function public.confirm_outbound_message_without_resend(
  p_message_id uuid,
  p_provider_message_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.outbound_messages%rowtype;
  message_id text;
  updated public.outbound_messages%rowtype;
begin
  select * into current_row
  from public.outbound_messages
  where id = p_message_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Outbound message not found.');
  end if;

  perform public.assert_outbound_workspace_access(current_row.workspace_id);

  if current_row.status is distinct from 'unknown' then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Only unsettled (unknown) notifications can be confirmed without resending.',
      'status', current_row.status
    );
  end if;

  message_id := nullif(trim(coalesce(p_provider_message_id, '')), '');
  if message_id is null then
    message_id := nullif(trim(coalesce(current_row.provider_message_id, '')), '');
  end if;
  if message_id is null or char_length(message_id) < 8 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'Enter the provider message id from the email dashboard.',
      'status', 'unknown'
    );
  end if;

  update public.outbound_messages
  set
    status = 'provider_accepted',
    provider = coalesce(provider, 'resend'),
    provider_message_id = message_id,
    last_error = null
    -- Keep original attempt_at as evidence.
  where id = p_message_id
    and status = 'unknown'
  returning * into updated;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Could not confirm this notification.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', updated.id,
    'status', updated.status,
    'provider_message_id', updated.provider_message_id
  );
end;
$$;

revoke all on function public.confirm_outbound_message_without_resend(uuid, text)
  from public, anon;
grant execute on function public.confirm_outbound_message_without_resend(uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Crash recovery: stale sending → unknown (never auto-resend)
-- ---------------------------------------------------------------------------
create or replace function public.reconcile_stale_outbound_sending(
  p_stale_after interval default interval '15 minutes'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if auth.role() is distinct from 'service_role'
     and public.current_workspace_id() is null then
    raise exception 'Not authorised to reconcile outbound messages';
  end if;

  if auth.role() = 'service_role' then
    update public.outbound_messages
    set
      status = 'unknown',
      last_error = coalesce(
        nullif(trim(coalesce(last_error, '')), ''),
        'Send interrupted before outcome was recorded. Do not resend blindly.'
      )
    where status = 'sending'
      and attempt_at is not null
      and attempt_at < now() - p_stale_after;
    get diagnostics updated_count = row_count;
  else
    update public.outbound_messages
    set
      status = 'unknown',
      last_error = coalesce(
        nullif(trim(coalesce(last_error, '')), ''),
        'Send interrupted before outcome was recorded. Do not resend blindly.'
      )
    where workspace_id = public.current_workspace_id()
      and status = 'sending'
      and attempt_at is not null
      and attempt_at < now() - p_stale_after;
    get diagnostics updated_count = row_count;
  end if;

  return jsonb_build_object('ok', true, 'reconciled', updated_count);
end;
$$;

revoke all on function public.reconcile_stale_outbound_sending(interval)
  from public, anon;
grant execute on function public.reconcile_stale_outbound_sending(interval)
  to authenticated, service_role;
