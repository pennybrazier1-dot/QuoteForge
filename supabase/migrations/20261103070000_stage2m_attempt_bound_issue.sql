-- Stage 2M: bind revision issue finalisation to the exact claim/attempt.
-- Local only until authorised.

-- ---------------------------------------------------------------------------
-- 1) Claim: never start a different attempt lineage for the same revision
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

  -- Unsettled provider attempt for this revision blocks any new send lineage.
  if v_proposal.issue_attempt_message_id is not null
     and v_proposal.issue_attempt_content_revision is not distinct from p_expected_content_revision then
    return jsonb_build_object(
      'ok', false,
      'error', 'A previous issue attempt for this revision is still unsettled. Use Confirm issue without resending.',
      'claim_held', true,
      'unknown_outcome', true
    );
  end if;

  -- Same claim key may observe the in-flight attempt (no second send).
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

  -- A different claim key for this revision is never allowed while a claim exists.
  -- (Previously TTL could overwrite; that allowed attempt B to erase attempt A.)
  if v_proposal.issue_send_claim_at is not null
     and v_proposal.issue_send_claim_revision is not distinct from p_expected_content_revision
     and v_proposal.issue_send_claim_key is distinct from v_key then
    return jsonb_build_object(
      'ok', false,
      'error', 'Another issue attempt for this revision is already in progress or unsettled. Do not start a second send.',
      'claim_held', true
    );
  end if;

  -- Active claim for a different key/revision still blocks concurrent senders.
  if v_proposal.issue_send_claim_at is not null
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

-- ---------------------------------------------------------------------------
-- 2) Issue RPC: require matching claim key + attempt message id
-- ---------------------------------------------------------------------------
-- p_claim_key has no DEFAULT: a DEFAULT here would make 4-arg calls ambiguous
-- against the compatibility wrapper below (Stage 2N release-prep finding).
create or replace function public.issue_proposal_revision(
  p_proposal_id uuid,
  p_expected_content_revision integer,
  p_provider text,
  p_message_id text,
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
  v_revision public.proposal_revisions%rowtype;
  v_issued_at timestamptz := now();
  v_claim_key text := nullif(trim(coalesce(p_claim_key, '')), '');
  v_message_id text := nullif(trim(coalesce(p_message_id, '')), '');
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  end if;

  if p_provider is null or p_provider not in ('simulated', 'resend') then
    return jsonb_build_object('ok', false, 'error', 'Unknown issue provider.');
  end if;

  if v_message_id is null then
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

  -- Exact-attempt binding: when a claim is held for this revision, the caller must
  -- supply that claim key. A null key (4-arg compatibility wrapper) must not bypass
  -- attempt binding or leave an orphaned claim after a successful issue.
  if v_proposal.issue_send_claim_key is not null
     and v_proposal.issue_send_claim_revision is not distinct from p_expected_content_revision
     and v_claim_key is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'This revision has an active send attempt. Finalise with the matching claim key.',
      'stale_attempt', true,
      'claim_required', true
    );
  end if;

  -- Exact-attempt binding: a different claim key means a newer lineage owns this revision.
  if v_proposal.issue_send_claim_key is not null
     and v_proposal.issue_send_claim_revision is not distinct from p_expected_content_revision
     and v_claim_key is not null
     and v_proposal.issue_send_claim_key is distinct from v_claim_key then
    return jsonb_build_object(
      'ok', false,
      'error', 'This issue result does not match the active send attempt. It cannot finalise or clear the newer attempt.',
      'stale_attempt', true
    );
  end if;

  -- If an attempt message id is stored for this revision, only that id may finalise.
  if v_proposal.issue_attempt_message_id is not null
     and v_proposal.issue_attempt_content_revision is not distinct from p_expected_content_revision
     and v_proposal.issue_attempt_message_id is distinct from v_message_id then
    return jsonb_build_object(
      'ok', false,
      'error', 'This provider message id does not match the stored attempt for this revision.',
      'stale_attempt', true
    );
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
    issue_message_id = v_message_id
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
    -- Clear claim only for this exact attempt (matching claim key).
    issue_send_claim_at = case
      when v_proposal.issue_send_claim_revision is distinct from p_expected_content_revision
        then v_proposal.issue_send_claim_at
      when v_proposal.issue_send_claim_key is null then null
      when v_claim_key is not null
        and v_proposal.issue_send_claim_key = v_claim_key then null
      else v_proposal.issue_send_claim_at
    end,
    issue_send_claim_revision = case
      when v_proposal.issue_send_claim_revision is distinct from p_expected_content_revision
        then v_proposal.issue_send_claim_revision
      when v_proposal.issue_send_claim_key is null then null
      when v_claim_key is not null
        and v_proposal.issue_send_claim_key = v_claim_key then null
      else v_proposal.issue_send_claim_revision
    end,
    issue_send_claim_key = case
      when v_proposal.issue_send_claim_revision is distinct from p_expected_content_revision
        then v_proposal.issue_send_claim_key
      when v_proposal.issue_send_claim_key is null then null
      when v_claim_key is not null
        and v_proposal.issue_send_claim_key = v_claim_key then null
      else v_proposal.issue_send_claim_key
    end,
    issue_send_claim_by = case
      when v_proposal.issue_send_claim_revision is distinct from p_expected_content_revision
        then v_proposal.issue_send_claim_by
      when v_proposal.issue_send_claim_key is null then null
      when v_claim_key is not null
        and v_proposal.issue_send_claim_key = v_claim_key then null
      else v_proposal.issue_send_claim_by
    end
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
      'provider_message_id', v_message_id,
      'claim_key', v_claim_key,
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
    'message_id', v_message_id
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
$$;

-- Keep the 4-arg overload calling the 5-arg form for older clients.
create or replace function public.issue_proposal_revision(
  p_proposal_id uuid,
  p_expected_content_revision integer,
  p_provider text,
  p_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.issue_proposal_revision(
    p_proposal_id,
    p_expected_content_revision,
    p_provider,
    p_message_id,
    null
  );
end;
$$;

revoke all on function public.claim_proposal_revision_send(uuid, integer, text) from public;
revoke all on function public.claim_proposal_revision_send(uuid, integer, text) from anon;
grant execute on function public.claim_proposal_revision_send(uuid, integer, text) to authenticated;
grant execute on function public.claim_proposal_revision_send(uuid, integer, text) to service_role;

revoke all on function public.issue_proposal_revision(uuid, integer, text, text) from public;
revoke all on function public.issue_proposal_revision(uuid, integer, text, text) from anon;
grant execute on function public.issue_proposal_revision(uuid, integer, text, text) to authenticated;
grant execute on function public.issue_proposal_revision(uuid, integer, text, text) to service_role;

revoke all on function public.issue_proposal_revision(uuid, integer, text, text, text) from public;
revoke all on function public.issue_proposal_revision(uuid, integer, text, text, text) from anon;
grant execute on function public.issue_proposal_revision(uuid, integer, text, text, text) to authenticated;
grant execute on function public.issue_proposal_revision(uuid, integer, text, text, text) to service_role;
