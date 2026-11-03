-- Stage 2K follow-up: serialize accept+slot booking per workspace diary slot.
-- Fixes TOCTOU where two concurrent accepts both passed the conflict SELECT
-- before either wrote booking_confirmation.
-- Local only until authorised for production.

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
  v_slot_lock_key bigint;
begin
  if p_expected_content_revision is null or p_expected_content_revision < 0 then
    return jsonb_build_object('ok', false, 'error', 'Missing proposal revision. Refresh and try again.');
  end if;

  if p_source is null or p_source not in ('customer_portal', 'trader_acceptance', 'trader_booking') then
    return jsonb_build_object('ok', false, 'error', 'Unknown acceptance source.');
  end if;

  if v_user_id is not null then
    select workspace_id into v_workspace_id
    from public.profiles
    where id = v_user_id;
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

  -- Serialize concurrent accept+slot writers for this workspace diary slot.
  if p_planned_start_date is not null then
    v_slot_lock_key := hashtextextended(
      v_proposal.workspace_id::text
        || chr(1)
        || p_planned_start_date::text
        || chr(1)
        || coalesce(v_start_time, ''),
      0
    );
    perform pg_advisory_xact_lock(v_slot_lock_key);

    select o.id into v_conflict_id
    from public.proposals o
    where o.workspace_id = v_proposal.workspace_id
      and o.id is distinct from v_proposal.id
      and o.planned_start_date is not distinct from p_planned_start_date
      and coalesce(o.planned_start_time, '') = coalesce(v_start_time, '')
      and o.booking_confirmation in ('confirmed', 'provisional')
      and o.status in ('booked', 'waiting_for_customer', 'needs_attention')
    limit 1;

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
    planned_start_date_text = coalesce(v_start_text, planned_start_date_text)
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
