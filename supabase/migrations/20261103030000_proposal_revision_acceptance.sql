-- Stage 2I: version-safe proposal acceptance + issue-attempt recovery metadata.
-- Local migration only — do not apply to production until authorised.

alter table public.proposals
  add column if not exists accepted_content_revision integer
    check (accepted_content_revision is null or accepted_content_revision >= 0);

alter table public.proposals
  add column if not exists accepted_total_amount integer
    check (accepted_total_amount is null or accepted_total_amount >= 0);

comment on column public.proposals.accepted_content_revision is
  'content_revision value accepted by the customer (or recorded by trader). Null until accepted.';

comment on column public.proposals.accepted_total_amount is
  'Agreed total in pence at acceptance. Audit snapshot; does not replace live total_amount.';

-- Provider accepted send but issue RPC may still fail. Visible to trader only.
alter table public.proposals
  add column if not exists issue_attempt_at timestamptz;

alter table public.proposals
  add column if not exists issue_attempt_provider text
    check (
      issue_attempt_provider is null
      or issue_attempt_provider in ('simulated', 'resend')
    );

alter table public.proposals
  add column if not exists issue_attempt_message_id text;

comment on column public.proposals.issue_attempt_at is
  'When a revision email provider accepted a send while local issue was still pending. Cleared on successful issue.';

comment on column public.proposals.issue_attempt_message_id is
  'Provider message id from an uncertain issue attempt. Used for reconcile-without-resend.';

create or replace function public.accept_proposal_at_revision(
  p_proposal_id uuid,
  p_expected_content_revision integer,
  p_accepted_at timestamptz,
  p_booking_confirmation text,
  p_source text,
  p_require_workspace_owner boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  -- Stage 2Q: authorisation is established at FIRST creation of this function.
  -- Do not trust a missing uid alone; require an explicit service_role JWT for
  -- the portal/server path. p_require_workspace_owner cannot disable ownership.
  v_jwt_role text := coalesce(
    auth.jwt() ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  );
  v_workspace_id uuid;
  v_proposal public.proposals%rowtype;
  v_accepted_at timestamptz := coalesce(p_accepted_at, now());
  v_booking text := nullif(trim(coalesce(p_booking_confirmation, '')), '');
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
    null; -- trusted server after application portal-token validation
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

  -- Idempotent: already accepted at this exact revision.
  if v_proposal.status = 'booked'
     and v_proposal.accepted_content_revision is not distinct from p_expected_content_revision then
    return jsonb_build_object(
      'ok', true,
      'already_accepted', true,
      'content_revision', v_proposal.content_revision,
      'accepted_content_revision', v_proposal.accepted_content_revision,
      'accepted_total_amount', v_proposal.accepted_total_amount,
      'total_amount', v_proposal.total_amount,
      'accepted_at', v_proposal.accepted_at
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

  -- Original quotes (revision 0) never required an issue stamp.
  -- Revised quotes must be issued at the live revision.
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
    issue_attempt_message_id = null
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
      'accepted_total_amount', v_proposal.total_amount
    ),
    case when p_require_workspace_owner then v_user_id else null end,
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

revoke all on function public.accept_proposal_at_revision(uuid, integer, timestamptz, text, text, boolean) from public;
revoke all on function public.accept_proposal_at_revision(uuid, integer, timestamptz, text, text, boolean) from anon;
grant execute on function public.accept_proposal_at_revision(uuid, integer, timestamptz, text, text, boolean) to authenticated;
grant execute on function public.accept_proposal_at_revision(uuid, integer, timestamptz, text, text, boolean) to service_role;

-- Clear issue attempt metadata when a revision is successfully issued.
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
    issue_attempt_message_id = null
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
$$;

revoke all on function public.issue_proposal_revision(uuid, integer, text, text) from public;
revoke all on function public.issue_proposal_revision(uuid, integer, text, text) from anon;
grant execute on function public.issue_proposal_revision(uuid, integer, text, text) to authenticated;
