-- Stage 2K: accept auth hardening, issue send claims, atomic accept+slot.
-- Local migration only — do not apply to production until authorised.

-- ---------------------------------------------------------------------------
-- 1) Issue send claim (claim BEFORE provider send)
-- ---------------------------------------------------------------------------
alter table public.proposals
  add column if not exists issue_send_claim_at timestamptz;

alter table public.proposals
  add column if not exists issue_send_claim_revision integer
    check (issue_send_claim_revision is null or issue_send_claim_revision >= 0);

alter table public.proposals
  add column if not exists issue_send_claim_key text;

alter table public.proposals
  add column if not exists issue_send_claim_by uuid;

comment on column public.proposals.issue_send_claim_at is
  'When a trader claimed the right to send this unsent revision. Cleared on issue success or expired claim reclaim.';

comment on column public.proposals.issue_send_claim_key is
  'Stable idempotency key for the claimed send attempt. Bound to content_revision.';

-- ---------------------------------------------------------------------------
-- 2) Accept RPC: role-based trust + optional atomic slot booking
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
begin
  if p_expected_content_revision is null or p_expected_content_revision < 0 then
    return jsonb_build_object('ok', false, 'error', 'Missing proposal revision. Refresh and try again.');
  end if;

  if p_source is null or p_source not in ('customer_portal', 'trader_acceptance', 'trader_booking') then
    return jsonb_build_object('ok', false, 'error', 'Unknown acceptance source.');
  end if;

  -- Stage 2K: missing uid is NOT enough. Only service_role may use the
  -- server/portal path. Anonymous and other roles are refused.
  if v_user_id is not null then
    select workspace_id into v_workspace_id
    from public.profiles
    where id = v_user_id;
    if v_workspace_id is null then
      return jsonb_build_object('ok', false, 'error', 'Could not find your workspace.');
    end if;
  elsif v_jwt_role = 'service_role' then
    null; -- trusted server after application token validation
  else
    return jsonb_build_object('ok', false, 'error', 'Not authorised.');
  end if;

  -- p_require_workspace_owner cannot disable ownership for authenticated users.
  if v_user_id is not null and p_require_workspace_owner is distinct from true
     and p_source in ('trader_acceptance', 'trader_booking') then
    -- Still enforce ownership below; flag is informational only for traders.
    null;
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

  -- Atomic diary conflict check when booking a specific slot with acceptance.
  if p_planned_start_date is not null then
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

-- Drop old 6-arg overload if present so callers use the new signature.
drop function if exists public.accept_proposal_at_revision(uuid, integer, timestamptz, text, text, boolean);

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
-- 3) Claim send before provider email
-- ---------------------------------------------------------------------------
create or replace function public.claim_proposal_revision_send(
  p_proposal_id uuid,
  p_expected_content_revision integer,
  p_claim_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_proposal public.proposals%rowtype;
  v_now timestamptz := now();
  v_claim_ttl interval := interval '15 minutes';
  v_key text := nullif(trim(coalesce(p_claim_key, '')), '');
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  end if;
  if v_key is null then
    return jsonb_build_object('ok', false, 'error', 'Issue claim key is required.');
  end if;
  if p_expected_content_revision is null or p_expected_content_revision <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Missing proposal revision. Refresh and try again.');
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
  if v_proposal.unsent_revision_at is null then
    return jsonb_build_object('ok', false, 'error', 'No unsent revision is waiting to be issued.');
  end if;
  if v_proposal.content_revision is distinct from p_expected_content_revision then
    return jsonb_build_object(
      'ok', false,
      'error', 'This proposal was updated elsewhere. Refresh and try again.',
      'stale_revision', true
    );
  end if;
  if v_proposal.status is distinct from 'needs_attention' then
    return jsonb_build_object('ok', false, 'error', 'Only proposals that need attention can issue a revised quote right now.');
  end if;

  -- Same claim key may retry (idempotent reclaim of own in-flight attempt).
  if v_proposal.issue_send_claim_at is not null
     and v_proposal.issue_send_claim_key is not distinct from v_key
     and v_proposal.issue_send_claim_revision is not distinct from p_expected_content_revision then
    return jsonb_build_object(
      'ok', true,
      'already_claimed', true,
      'claim_key', v_key,
      'content_revision', v_proposal.content_revision
    );
  end if;

  -- Another active claim blocks concurrent senders.
  if v_proposal.issue_send_claim_at is not null
     and v_proposal.issue_send_claim_at > (v_now - v_claim_ttl)
     and v_proposal.issue_send_claim_key is distinct from v_key then
    return jsonb_build_object(
      'ok', false,
      'error', 'Another issue attempt is already in progress. Wait a moment, then refresh.',
      'claim_held', true
    );
  end if;

  update public.proposals
  set
    issue_send_claim_at = v_now,
    issue_send_claim_revision = p_expected_content_revision,
    issue_send_claim_key = v_key,
    issue_send_claim_by = v_user_id
  where id = v_proposal.id
    and content_revision = p_expected_content_revision
    and unsent_revision_at is not null
    and (
      issue_send_claim_at is null
      or issue_send_claim_at <= (v_now - v_claim_ttl)
      or issue_send_claim_key = v_key
    );

  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', 'Could not claim this revision for sending. Refresh and try again.',
      'claim_held', true
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'already_claimed', false,
    'claim_key', v_key,
    'content_revision', p_expected_content_revision
  );
end;
$$;

revoke all on function public.claim_proposal_revision_send(uuid, integer, text) from public;
revoke all on function public.claim_proposal_revision_send(uuid, integer, text) from anon;
grant execute on function public.claim_proposal_revision_send(uuid, integer, text) to authenticated;

-- Block save while an active send claim exists for the live revision.
-- Body matches Stage 2G save_proposal_revision plus claim/attempt clears.
create or replace function public.save_proposal_revision(
  p_proposal_id uuid,
  p_expected_content_revision integer,
  p_scope_of_work text,
  p_job_summary text,
  p_materials jsonb,
  p_labour jsonb,
  p_labour_description text,
  p_subtotal_amount integer,
  p_vat_amount integer,
  p_total_amount integer,
  p_change_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_proposal public.proposals%rowtype;
  v_next_revision integer;
  v_revision_id uuid;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  end if;

  select workspace_id into v_workspace_id
  from public.profiles
  where id = v_user_id;

  if v_workspace_id is null then
    return jsonb_build_object('ok', false, 'error', 'Could not find your workspace.');
  end if;

  if p_expected_content_revision is null or p_expected_content_revision < 0 then
    return jsonb_build_object('ok', false, 'error', 'Missing expected revision version.');
  end if;

  if p_materials is null or jsonb_typeof(p_materials) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'Materials must be a list.');
  end if;

  if p_labour is null or jsonb_typeof(p_labour) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'Labour must be a list.');
  end if;

  if p_subtotal_amount is null or p_subtotal_amount < 0
     or p_vat_amount is null or p_vat_amount < 0
     or p_total_amount is null or p_total_amount < 0 then
    return jsonb_build_object('ok', false, 'error', 'Amounts must be non-negative pence values.');
  end if;

  if p_total_amount <> p_subtotal_amount + p_vat_amount then
    return jsonb_build_object(
      'ok', false,
      'error', 'Total must equal subtotal plus VAT.'
    );
  end if;

  if p_total_amount = 0 then
    return jsonb_build_object('ok', false, 'error', 'Revised total must be greater than zero.');
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

  if v_proposal.status is distinct from 'needs_attention' then
    return jsonb_build_object(
      'ok', false,
      'error', 'Only proposals that need attention can be revised right now.'
    );
  end if;

  if v_proposal.content_revision is distinct from p_expected_content_revision then
    return jsonb_build_object(
      'ok', false,
      'error', 'This proposal was updated elsewhere. Refresh and try again.'
    );
  end if;

  if v_proposal.issue_send_claim_at is not null
     and v_proposal.issue_send_claim_at > (v_now - interval '15 minutes')
     and v_proposal.issue_send_claim_revision is not distinct from v_proposal.content_revision then
    return jsonb_build_object(
      'ok', false,
      'error', 'An issue send is in progress for this revision. Wait for it to finish before editing.',
      'claim_held', true
    );
  end if;

  if p_vat_amount is distinct from v_proposal.vat_amount then
    return jsonb_build_object(
      'ok', false,
      'error', 'VAT treatment cannot be changed during a revision.'
    );
  end if;

  v_next_revision := v_proposal.content_revision + 1;

  insert into public.proposal_revisions (
    workspace_id,
    proposal_id,
    revision_number,
    previous_scope_of_work,
    previous_job_summary,
    previous_materials,
    previous_labour,
    previous_labour_description,
    previous_subtotal_amount,
    previous_vat_amount,
    previous_total_amount,
    new_scope_of_work,
    new_job_summary,
    new_materials,
    new_labour,
    new_labour_description,
    new_subtotal_amount,
    new_vat_amount,
    new_total_amount,
    change_notes,
    created_by
  )
  values (
    v_proposal.workspace_id,
    v_proposal.id,
    v_next_revision,
    v_proposal.scope_of_work,
    v_proposal.job_summary,
    coalesce(v_proposal.materials, '[]'::jsonb),
    coalesce(v_proposal.labour, '[]'::jsonb),
    v_proposal.labour_description,
    v_proposal.subtotal_amount,
    v_proposal.vat_amount,
    v_proposal.total_amount,
    nullif(trim(coalesce(p_scope_of_work, '')), ''),
    nullif(trim(coalesce(p_job_summary, '')), ''),
    p_materials,
    p_labour,
    nullif(trim(coalesce(p_labour_description, '')), ''),
    p_subtotal_amount,
    p_vat_amount,
    p_total_amount,
    nullif(trim(coalesce(p_change_notes, '')), ''),
    v_user_id
  )
  returning id into v_revision_id;

  update public.proposals
  set
    scope_of_work = nullif(trim(coalesce(p_scope_of_work, '')), ''),
    job_summary = nullif(trim(coalesce(p_job_summary, '')), ''),
    materials = p_materials,
    labour = p_labour,
    labour_description = nullif(trim(coalesce(p_labour_description, '')), ''),
    subtotal_amount = p_subtotal_amount,
    vat_amount = p_vat_amount,
    total_amount = p_total_amount,
    content_revision = v_next_revision,
    unsent_revision_at = now(),
    attention_reason = 'revision_ready_to_send',
    status = 'needs_attention',
    issue_send_claim_at = null,
    issue_send_claim_revision = null,
    issue_send_claim_key = null,
    issue_send_claim_by = null,
    issue_attempt_at = null,
    issue_attempt_provider = null,
    issue_attempt_message_id = null,
    issue_attempt_content_revision = null
  where id = v_proposal.id
    and content_revision = p_expected_content_revision;

  if not found then
    raise exception 'Concurrent revision conflict';
  end if;

  insert into public.proposal_status_events (
    workspace_id,
    proposal_id,
    event_type,
    from_status,
    to_status,
    note,
    metadata,
    created_by
  )
  values (
    v_proposal.workspace_id,
    v_proposal.id,
    'status_change',
    v_proposal.status,
    'needs_attention',
    format(
      'Proposal revised from %s to %s pence (revision %s)',
      v_proposal.total_amount,
      p_total_amount,
      v_next_revision
    ),
    jsonb_build_object(
      'source', 'trader',
      'action', 'save_proposal_revision',
      'revision_id', v_revision_id,
      'revision_number', v_next_revision,
      'previous_total_amount', v_proposal.total_amount,
      'new_total_amount', p_total_amount,
      'unsent_revision', true
    ),
    v_user_id
  );

  return jsonb_build_object(
    'ok', true,
    'revision_id', v_revision_id,
    'revision_number', v_next_revision,
    'content_revision', v_next_revision,
    'previous_total_amount', v_proposal.total_amount,
    'new_total_amount', p_total_amount
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'ok', false,
      'error', 'A revision was already saved. Refresh and try again.'
    );
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(sqlerrm, 'Could not save the revised proposal.')
    );
end;
$$;

revoke all on function public.save_proposal_revision(
  uuid, integer, text, text, jsonb, jsonb, text, integer, integer, integer, text
) from public;
revoke all on function public.save_proposal_revision(
  uuid, integer, text, text, jsonb, jsonb, text, integer, integer, integer, text
) from anon;
grant execute on function public.save_proposal_revision(
  uuid, integer, text, text, jsonb, jsonb, text, integer, integer, integer, text
) to authenticated;

-- Harden issue RPC grants (uid still required inside).
revoke all on function public.issue_proposal_revision(uuid, integer, text, text) from public;
revoke all on function public.issue_proposal_revision(uuid, integer, text, text) from anon;
grant execute on function public.issue_proposal_revision(uuid, integer, text, text) to authenticated;
