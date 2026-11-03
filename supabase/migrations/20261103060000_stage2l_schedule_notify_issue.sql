-- Stage 2L: shared schedule concurrency, booking-confirm tracking,
-- atomic issue claim finalisation. Local only until authorised.

-- ---------------------------------------------------------------------------
-- 0) Booking confirmation notification tracking
-- ---------------------------------------------------------------------------
alter table public.proposals
  add column if not exists booking_confirm_status text
    check (
      booking_confirm_status is null
      or booking_confirm_status in ('needed', 'sent', 'failed', 'unknown')
    );

alter table public.proposals
  add column if not exists booking_confirm_attempt_at timestamptz;

alter table public.proposals
  add column if not exists booking_confirm_attempt_provider text;

alter table public.proposals
  add column if not exists booking_confirm_attempt_message_id text;

comment on column public.proposals.booking_confirm_status is
  'Outcome of customer booking-confirmation email: needed/sent/failed/unknown. Null when not required.';

-- ---------------------------------------------------------------------------
-- 1) Duration parse (mirrors lib/calendar/job-span.ts intent)
-- ---------------------------------------------------------------------------
create or replace function public.parse_duration_calendar_days(p_duration text)
returns integer
language plpgsql
immutable
as $$
declare
  v_text text := lower(trim(coalesce(p_duration, '')));
  v_amount numeric;
  v_days integer;
begin
  if v_text = '' then
    return 1;
  end if;
  if v_text ~ '(cannot yet be determined|not specified|unknown|tbc|to be confirm)' then
    return 1;
  end if;
  if v_text ~ 'half[[:space:]-]*(a[[:space:]]*)?day' then
    return 1;
  end if;

  v_amount := nullif(substring(v_text from '([0-9]+(\.[0-9]+)?)'), '')::numeric;
  if v_amount is null then
    return 1;
  end if;
  v_days := greatest(1, ceil(v_amount)::integer);

  if v_text ~ '\mmonths?\M' then
    return least(v_days * 30, 60);
  end if;
  if v_text ~ '\mweeks?\M' then
    return least(v_days * 7, 60);
  end if;
  return least(v_days, 60);
end;
$$;

create or replace function public.proposal_schedule_end_date(
  p_start date,
  p_duration text
)
returns date
language sql
immutable
as $$
  select case
    when p_start is null then null
    else p_start + (greatest(public.parse_duration_calendar_days(p_duration), 1) - 1)
  end;
$$;

-- Overlap rule mirrors lib/proposals/slot-hold.ts overlapsWorkSlot:
-- shared calendar day(s) AND (either time missing OR times equal).
create or replace function public.find_overlapping_schedule_conflict(
  p_workspace_id uuid,
  p_proposal_id uuid,
  p_start date,
  p_time text,
  p_duration text
)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_time text := nullif(trim(coalesce(p_time, '')), '');
  v_end date := public.proposal_schedule_end_date(p_start, p_duration);
  v_conflict_id uuid;
  v_other_time text;
  v_other_end date;
begin
  if p_start is null then
    return null;
  end if;

  for v_conflict_id, v_other_time, v_other_end in
    select
      o.id,
      nullif(trim(coalesce(o.planned_start_time, '')), ''),
      public.proposal_schedule_end_date(o.planned_start_date, o.estimated_duration)
    from public.proposals o
    where o.workspace_id = p_workspace_id
      and o.id is distinct from p_proposal_id
      and o.planned_start_date is not null
      and o.booking_confirmation in ('confirmed', 'provisional')
      and o.status in ('booked', 'waiting_for_customer', 'needs_attention')
      and daterange(o.planned_start_date, public.proposal_schedule_end_date(o.planned_start_date, o.estimated_duration), '[]')
          && daterange(p_start, v_end, '[]')
  loop
    if v_time is null or v_other_time is null or v_time = v_other_time then
      return v_conflict_id;
    end if;
  end loop;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Shared schedule writer (workspace advisory lock + overlap + update)
-- ---------------------------------------------------------------------------
create or replace function public.write_proposal_schedule_slot(
  p_proposal_id uuid,
  p_planned_start_date date,
  p_planned_start_time text,
  p_planned_start_date_text text,
  p_booking_confirmation text,
  p_next_status text default null,
  p_attention_reason text default null,
  p_estimated_duration text default null,
  p_require_available boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_jwt_role text := coalesce(
    auth.jwt() ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  );
  v_workspace_id uuid;
  v_proposal public.proposals%rowtype;
  v_time text := nullif(trim(coalesce(p_planned_start_time, '')), '');
  v_text text := nullif(trim(coalesce(p_planned_start_date_text, '')), '');
  v_booking text := nullif(trim(coalesce(p_booking_confirmation, '')), '');
  v_duration text;
  v_conflict_id uuid;
  v_lock_key bigint;
  v_next_status text;
begin
  if p_planned_start_date is null then
    return jsonb_build_object('ok', false, 'error', 'Choose a start date for the calendar.');
  end if;
  if v_booking is null or v_booking not in ('confirmed', 'provisional') then
    return jsonb_build_object('ok', false, 'error', 'Choose a booking status.');
  end if;

  if v_user_id is not null then
    select workspace_id into v_workspace_id from public.profiles where id = v_user_id;
    if v_workspace_id is null then
      return jsonb_build_object('ok', false, 'error', 'Could not find your workspace.');
    end if;
  elsif v_jwt_role = 'service_role' then
    null;
  else
    return jsonb_build_object('ok', false, 'error', 'Not authorised.');
  end if;

  select * into v_proposal
  from public.proposals
  where id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Proposal not found.');
  end if;

  if v_user_id is not null
     and v_proposal.workspace_id is distinct from v_workspace_id then
    return jsonb_build_object('ok', false, 'error', 'Not authorised for this proposal.');
  end if;

  v_duration := coalesce(
    nullif(trim(coalesce(p_estimated_duration, '')), ''),
    v_proposal.estimated_duration
  );
  v_next_status := coalesce(nullif(trim(coalesce(p_next_status, '')), ''), v_proposal.status);

  -- Serialize ALL schedule writers for this workspace (exact-slot locks are insufficient).
  v_lock_key := hashtextextended('schedule:' || v_proposal.workspace_id::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  if p_require_available then
    v_conflict_id := public.find_overlapping_schedule_conflict(
      v_proposal.workspace_id,
      v_proposal.id,
      p_planned_start_date,
      v_time,
      v_duration
    );
    if v_conflict_id is not null then
      return jsonb_build_object(
        'ok', false,
        'error', 'That appointment was just taken. Please choose another time.',
        'slot_conflict', true,
        'conflict_proposal_id', v_conflict_id
      );
    end if;
  end if;

  update public.proposals
  set
    status = v_next_status,
    booking_confirmation = v_booking,
    planned_start_date = p_planned_start_date,
    planned_start_time = v_time,
    planned_start_date_text = coalesce(v_text, planned_start_date_text),
    estimated_duration = coalesce(v_duration, estimated_duration),
    attention_reason = p_attention_reason
  where id = v_proposal.id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Could not save this date.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'proposal_id', v_proposal.id,
    'planned_start_date', p_planned_start_date,
    'planned_start_time', v_time,
    'booking_confirmation', v_booking,
    'status', v_next_status
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(sqlerrm, 'Could not save this date.')
    );
end;
$$;

revoke all on function public.write_proposal_schedule_slot(
  uuid, date, text, text, text, text, text, text, boolean
) from public;
revoke all on function public.write_proposal_schedule_slot(
  uuid, date, text, text, text, text, text, text, boolean
) from anon;
grant execute on function public.write_proposal_schedule_slot(
  uuid, date, text, text, text, text, text, text, boolean
) to authenticated;
grant execute on function public.write_proposal_schedule_slot(
  uuid, date, text, text, text, text, text, text, boolean
) to service_role;

-- ---------------------------------------------------------------------------
-- 3) Accept RPC: workspace schedule lock + duration-aware overlap
-- ---------------------------------------------------------------------------
create or replace function public.accept_proposal_at_revision(
  p_proposal_id uuid,
  p_expected_content_revision integer,
  p_accepted_at timestamptz,
  p_booking_confirmation text,
  p_source text,
  p_require_workspace_owner boolean default false,
  p_planned_start_date date default null,
  p_planned_start_time text default null,
  p_planned_start_date_text text default null,
  p_require_slot boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_jwt_role text := coalesce(
    auth.jwt() ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  );
  v_workspace_id uuid;
  v_proposal public.proposals%rowtype;
  v_accepted_at timestamptz := coalesce(p_accepted_at, now());
  v_booking text := nullif(trim(coalesce(p_booking_confirmation, '')), '');
  v_start_time text := nullif(trim(coalesce(p_planned_start_time, '')), '');
  v_start_text text := nullif(trim(coalesce(p_planned_start_date_text, '')), '');
  v_conflict_id uuid;
  v_lock_key bigint;
begin
  if p_expected_content_revision is null or p_expected_content_revision < 0 then
    return jsonb_build_object('ok', false, 'error', 'Missing proposal revision. Refresh and try again.');
  end if;

  if p_source is null or p_source not in ('customer_portal', 'trader_acceptance', 'trader_booking') then
    return jsonb_build_object('ok', false, 'error', 'Unknown acceptance source.');
  end if;

  if v_user_id is not null then
    select workspace_id into v_workspace_id from public.profiles where id = v_user_id;
    if v_workspace_id is null then
      return jsonb_build_object('ok', false, 'error', 'Could not find your workspace.');
    end if;
  elsif v_jwt_role = 'service_role' then
    null;
  else
    return jsonb_build_object('ok', false, 'error', 'Not authorised.');
  end if;

  select * into v_proposal
  from public.proposals
  where id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Proposal not found.');
  end if;

  if v_user_id is not null
     and v_proposal.workspace_id is distinct from v_workspace_id then
    return jsonb_build_object('ok', false, 'error', 'Not authorised for this proposal.');
  end if;

  if v_proposal.status = 'booked'
     and v_proposal.accepted_content_revision is not distinct from p_expected_content_revision then
    return jsonb_build_object(
      'ok', true,
      'already_accepted', true,
      'content_revision', v_proposal.content_revision,
      'accepted_content_revision', v_proposal.accepted_content_revision,
      'accepted_total_amount', v_proposal.accepted_total_amount,
      'total_amount', v_proposal.total_amount,
      'accepted_at', v_proposal.accepted_at,
      'workspace_id', v_proposal.workspace_id
    );
  end if;

  if v_proposal.status = 'booked' then
    return jsonb_build_object(
      'ok', false,
      'error', 'This proposal was already accepted. Refresh to see the latest details.'
    );
  end if;

  if v_proposal.status not in ('waiting_for_customer', 'needs_attention') then
    return jsonb_build_object(
      'ok', false,
      'error', 'This proposal can no longer be accepted.'
    );
  end if;

  if v_proposal.unsent_revision_at is not null then
    return jsonb_build_object(
      'ok', false,
      'error', 'An updated proposal is being prepared. Please wait for the revised proposal before accepting.'
    );
  end if;

  if v_proposal.content_revision is distinct from p_expected_content_revision then
    return jsonb_build_object(
      'ok', false,
      'error', 'This quote has been updated. Please refresh the page and review the new total before accepting.',
      'stale_revision', true,
      'live_content_revision', v_proposal.content_revision,
      'expected_content_revision', p_expected_content_revision
    );
  end if;

  if v_proposal.content_revision > 0
     and v_proposal.issued_content_revision is distinct from v_proposal.content_revision then
    return jsonb_build_object(
      'ok', false,
      'error', 'This updated quote is not ready to accept yet. Please wait for the issued proposal.'
    );
  end if;

  if v_proposal.total_amount is null or v_proposal.total_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'This proposal does not have a valid price.');
  end if;

  if p_require_slot and p_planned_start_date is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'Please choose an available date before accepting this proposal.'
    );
  end if;

  if p_planned_start_date is not null then
    v_lock_key := hashtextextended('schedule:' || v_proposal.workspace_id::text, 0);
    perform pg_advisory_xact_lock(v_lock_key);

    v_conflict_id := public.find_overlapping_schedule_conflict(
      v_proposal.workspace_id,
      v_proposal.id,
      p_planned_start_date,
      v_start_time,
      v_proposal.estimated_duration
    );

    if v_conflict_id is not null then
      return jsonb_build_object(
        'ok', false,
        'error', 'That appointment was just taken. Please choose another time.',
        'slot_conflict', true,
        'conflict_proposal_id', v_conflict_id
      );
    end if;
  end if;

  update public.proposals
  set
    status = 'booked',
    booking_confirmation = coalesce(v_booking, booking_confirmation),
    accepted_at = coalesce(accepted_at, v_accepted_at),
    booked_at = coalesce(booked_at, v_accepted_at),
    attention_reason = null,
    accepted_content_revision = v_proposal.content_revision,
    accepted_total_amount = v_proposal.total_amount,
    issue_attempt_at = null,
    issue_attempt_provider = null,
    issue_attempt_message_id = null,
    issue_attempt_content_revision = null,
    issue_send_claim_at = null,
    issue_send_claim_revision = null,
    issue_send_claim_key = null,
    issue_send_claim_by = null,
    planned_start_date = coalesce(p_planned_start_date, planned_start_date),
    planned_start_time = coalesce(v_start_time, planned_start_time),
    planned_start_date_text = coalesce(v_start_text, planned_start_date_text),
    -- Mark confirmation as needed when customer email exists; app send fills outcome.
    booking_confirm_status = case
      when nullif(trim(coalesce(customer_email, '')), '') is not null
        then 'needed'
      else booking_confirm_status
    end
  where id = v_proposal.id
    and status in ('waiting_for_customer', 'needs_attention')
    and unsent_revision_at is null
    and content_revision = p_expected_content_revision
    and (
      content_revision = 0
      or issued_content_revision = content_revision
    );

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'This quote has been updated. Please refresh the page and review the new total before accepting.',
      'stale_revision', true
    );
  end if;

  insert into public.proposal_status_events (
    workspace_id,
    proposal_id,
    event_type,
    from_status,
    to_status,
    note,
    metadata,
    created_by,
    created_at
  )
  values (
    v_proposal.workspace_id,
    v_proposal.id,
    'status_change',
    v_proposal.status,
    'booked',
    format(
      'Proposal accepted at revision %s for %s pence (%s)',
      v_proposal.content_revision,
      v_proposal.total_amount,
      p_source
    ),
    jsonb_build_object(
      'source', p_source,
      'action', 'accept_proposal_at_revision',
      'content_revision', v_proposal.content_revision,
      'issued_content_revision', v_proposal.issued_content_revision,
      'accepted_content_revision', v_proposal.content_revision,
      'accepted_total_amount', v_proposal.total_amount,
      'slot_bound', p_planned_start_date is not null
    ),
    v_user_id,
    v_accepted_at
  );

  return jsonb_build_object(
    'ok', true,
    'already_accepted', false,
    'content_revision', v_proposal.content_revision,
    'accepted_content_revision', v_proposal.content_revision,
    'accepted_total_amount', v_proposal.total_amount,
    'total_amount', v_proposal.total_amount,
    'accepted_at', v_accepted_at,
    'workspace_id', v_proposal.workspace_id
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(sqlerrm, 'Could not accept this proposal.')
    );
end;
$$;

revoke all on function public.accept_proposal_at_revision(
  uuid, integer, timestamptz, text, text, boolean, date, text, text, boolean
) from public;
revoke all on function public.accept_proposal_at_revision(
  uuid, integer, timestamptz, text, text, boolean, date, text, text, boolean
) from anon;
grant execute on function public.accept_proposal_at_revision(
  uuid, integer, timestamptz, text, text, boolean, date, text, text, boolean
) to authenticated;
grant execute on function public.accept_proposal_at_revision(
  uuid, integer, timestamptz, text, text, boolean, date, text, text, boolean
) to service_role;

-- ---------------------------------------------------------------------------
-- 4) Atomic issue claim finalisation inside issue_proposal_revision
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_proposal_revision(p_proposal_id uuid, p_expected_content_revision integer, p_provider text, p_message_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_proposal public.proposals%rowtype;
  v_revision public.proposal_revisions%rowtype;
  v_issued_at timestamptz := now();
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  end if;

  if p_provider is null or p_provider not in ('simulated', 'resend') then
    return jsonb_build_object('ok', false, 'error', 'Unknown issue provider.');
  end if;

  if p_message_id is null or length(trim(p_message_id)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Issue confirmation id is required.');
  end if;

  select workspace_id into v_workspace_id
  from public.profiles
  where id = v_user_id;

  if v_workspace_id is null then
    return jsonb_build_object('ok', false, 'error', 'Could not find your workspace.');
  end if;

  select * into v_proposal
  from public.proposals
  where id = p_proposal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Proposal not found.');
  end if;

  if v_proposal.workspace_id is distinct from v_workspace_id then
    return jsonb_build_object('ok', false, 'error', 'Not authorised for this proposal.');
  end if;

  if v_proposal.unsent_revision_at is null
     and v_proposal.issued_content_revision is not distinct from p_expected_content_revision
     and v_proposal.content_revision = p_expected_content_revision then
    return jsonb_build_object(
      'ok', true,
      'already_issued', true,
      'content_revision', v_proposal.content_revision,
      'total_amount', v_proposal.total_amount
    );
  end if;

  if v_proposal.unsent_revision_at is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'No unsent revision is waiting to be issued.'
    );
  end if;

  if v_proposal.content_revision is distinct from p_expected_content_revision then
    return jsonb_build_object(
      'ok', false,
      'error', 'This proposal was updated elsewhere. Refresh and try again.'
    );
  end if;

  if v_proposal.status is distinct from 'needs_attention' then
    return jsonb_build_object(
      'ok', false,
      'error', 'Only proposals that need attention can issue a revised quote right now.'
    );
  end if;

  if v_proposal.total_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Revised total is invalid.');
  end if;

  select * into v_revision
  from public.proposal_revisions
  where proposal_id = v_proposal.id
    and revision_number = v_proposal.content_revision
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Revision history row is missing.');
  end if;

  if v_revision.issued_at is not null then
    return jsonb_build_object(
      'ok', false,
      'error', 'This revision was already issued. Refresh and try again.'
    );
  end if;

  if v_revision.new_total_amount is distinct from v_proposal.total_amount then
    return jsonb_build_object(
      'ok', false,
      'error', 'Live total does not match the saved revision. Refresh and try again.'
    );
  end if;

  if v_revision.previous_total_amount = v_revision.new_total_amount
     and coalesce(v_revision.previous_scope_of_work, '') = coalesce(v_revision.new_scope_of_work, '')
     and coalesce(v_revision.previous_job_summary, '') = coalesce(v_revision.new_job_summary, '')
     and v_revision.previous_materials = v_revision.new_materials
     and v_revision.previous_labour = v_revision.new_labour
     and coalesce(v_revision.previous_labour_description, '') = coalesce(v_revision.new_labour_description, '') then
    return jsonb_build_object(
      'ok', false,
      'error', 'Cannot issue an unchanged quote as a revision.'
    );
  end if;

  update public.proposal_revisions
  set
    issued_at = v_issued_at,
    issue_provider = p_provider,
    issue_message_id = trim(p_message_id)
  where id = v_revision.id
    and issued_at is null;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'This revision was already issued. Refresh and try again.'
    );
  end if;

  update public.proposals
  set
    status = 'waiting_for_customer',
    attention_reason = null,
    unsent_revision_at = null,
    issued_content_revision = v_proposal.content_revision,
    sent_at = v_issued_at,
    issue_attempt_at = null,
    issue_attempt_provider = null,
    issue_attempt_message_id = null,
    issue_attempt_content_revision = null,
    -- Clear claim only for this revision; never wipe a newer claim.
    issue_send_claim_at = case
      when issue_send_claim_revision is null
        or issue_send_claim_revision = p_expected_content_revision
      then null else issue_send_claim_at end,
    issue_send_claim_revision = case
      when issue_send_claim_revision is null
        or issue_send_claim_revision = p_expected_content_revision
      then null else issue_send_claim_revision end,
    issue_send_claim_key = case
      when issue_send_claim_revision is null
        or issue_send_claim_revision = p_expected_content_revision
      then null else issue_send_claim_key end,
    issue_send_claim_by = case
      when issue_send_claim_revision is null
        or issue_send_claim_revision = p_expected_content_revision
      then null else issue_send_claim_by end
  where id = v_proposal.id
    and content_revision = p_expected_content_revision
    and unsent_revision_at is not null;

  if not found then
    raise exception 'Concurrent issue conflict';
  end if;

  insert into public.proposal_status_events (
    workspace_id,
    proposal_id,
    event_type,
    from_status,
    to_status,
    note,
    metadata,
    created_by,
    created_at
  )
  values (
    v_proposal.workspace_id,
    v_proposal.id,
    'emailed',
    v_proposal.status,
    'waiting_for_customer',
    format(
      'Revised proposal issued (%s pence, revision %s, provider %s)',
      v_proposal.total_amount,
      v_proposal.content_revision,
      p_provider
    ),
    jsonb_build_object(
      'source', 'trader',
      'action', 'issue_proposal_revision',
      'send_kind', 'revised',
      'provider', p_provider,
      'provider_message_id', trim(p_message_id),
      'revision_number', v_proposal.content_revision,
      'revision_id', v_revision.id,
      'previous_total_amount', v_revision.previous_total_amount,
      'new_total_amount', v_revision.new_total_amount,
      'simulated', p_provider = 'simulated',
      'delivery_confirmed_to_customer', false,
      'reconciled_from_attempt', false
    ),
    v_user_id,
    v_issued_at
  );

  return jsonb_build_object(
    'ok', true,
    'already_issued', false,
    'content_revision', v_proposal.content_revision,
    'revision_id', v_revision.id,
    'previous_total_amount', v_revision.previous_total_amount,
    'new_total_amount', v_revision.new_total_amount,
    'provider', p_provider,
    'message_id', trim(p_message_id)
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'error', 'A revision issue is already in progress. Refresh and try again.'
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(sqlerrm, 'Could not issue the revised proposal.')
    );
end;
$function$

;

revoke all on function public.issue_proposal_revision(uuid, integer, text, text) from public;
revoke all on function public.issue_proposal_revision(uuid, integer, text, text) from anon;
grant execute on function public.issue_proposal_revision(uuid, integer, text, text) to authenticated;
grant execute on function public.issue_proposal_revision(uuid, integer, text, text) to service_role;
