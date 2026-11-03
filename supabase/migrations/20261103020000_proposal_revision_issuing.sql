-- Stage 2H: mark revisions issued safely after successful delivery/simulation.
-- Local migration only — do not apply to production until authorised.

alter table public.proposals
  add column if not exists issued_content_revision integer
    check (issued_content_revision is null or issued_content_revision >= 0);

comment on column public.proposals.issued_content_revision is
  'Last content_revision successfully issued to the customer. Null until first successful revision issue.';

alter table public.proposal_revisions
  add column if not exists issued_at timestamptz;

alter table public.proposal_revisions
  add column if not exists issue_provider text
    check (
      issue_provider is null
      or issue_provider in ('simulated', 'resend')
    );

alter table public.proposal_revisions
  add column if not exists issue_message_id text;

comment on column public.proposal_revisions.issued_at is
  'When this revision was successfully issued (simulated or provider-accepted). Null while unsent.';

-- Current unsent revision is identified by proposals.unsent_revision_at
-- plus proposal_revisions.revision_number = proposals.content_revision.
-- Multiple saved-but-unissued history rows may exist if the trader saves again
-- before issuing; only the current content_revision can be issued.

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

  -- Idempotent success if this revision was already issued and lock cleared.
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
    sent_at = v_issued_at
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
      'delivery_confirmed_to_customer', false
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
