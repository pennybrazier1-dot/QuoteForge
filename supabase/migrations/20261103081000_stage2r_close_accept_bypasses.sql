-- Stage 2R — close remaining first-booked bypasses.
-- Additive after 20261103080000. Does not rewrite prior migrations.
--
-- Bypass 1: waiting/needs_attention → completed → booked used the unconditional
-- completed→booked reopen exemption and skipped trusted acceptance.
-- Bypass 2: INSERT … status='booked' skipped the UPDATE-only trigger.
--
-- Prior acceptance proof cannot be proposal columns (accepted_at,
-- accepted_content_revision, …) or proposal_status_events — authorised clients
-- can forge those. Use an append-only receipt table that client roles cannot
-- write; only SECURITY DEFINER accept_proposal_at_revision inserts rows.
-- Migration-time backfill grandfathers rows already booked/completed/closed
-- before this guard (one-time operator apply, not a runtime forge path).

create table if not exists public.proposal_trusted_acceptances (
  proposal_id uuid primary key references public.proposals (id) on delete cascade,
  content_revision integer not null,
  total_amount integer not null,
  accepted_at timestamptz not null,
  source text not null,
  recorded_at timestamptz not null default now()
);

comment on table public.proposal_trusted_acceptances is
  'Immutable receipt that accept_proposal_at_revision recorded a first acceptance. Not an application API.';

revoke all on table public.proposal_trusted_acceptances from public;
revoke all on table public.proposal_trusted_acceptances from anon;
revoke all on table public.proposal_trusted_acceptances from authenticated;
revoke all on table public.proposal_trusted_acceptances from service_role;

-- One-time grandfather of work already past first acceptance before this guard.
insert into public.proposal_trusted_acceptances (
  proposal_id,
  content_revision,
  total_amount,
  accepted_at,
  source
)
select
  p.id,
  coalesce(p.accepted_content_revision, p.content_revision, 0),
  coalesce(p.accepted_total_amount, p.total_amount, 0),
  coalesce(p.accepted_at, p.booked_at, p.completed_at, now()),
  'migration_backfill_pre_trusted_accept'
from public.proposals p
where p.status in ('booked', 'completed', 'closed')
on conflict (proposal_id) do nothing;

create or replace function public.enforce_proposal_accept_via_rpc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is not distinct from 'booked' then
      raise exception using
        errcode = 'P0001',
        message = 'Proposal acceptance must go through accept_proposal_at_revision.',
        detail = format('Blocked INSERT of proposal %s with status booked', new.id);
    end if;
    return new;
  end if;

  if new.status is distinct from 'booked' then
    return new;
  end if;

  -- No acceptance transition (already booked).
  if old.status is not distinct from 'booked' then
    return new;
  end if;

  -- Genuine reopen only: completed → booked when a trusted acceptance receipt exists.
  -- Do not trust forgeable proposal columns alone.
  if old.status = 'completed' then
    if exists (
      select 1
      from public.proposal_trusted_acceptances t
      where t.proposal_id = new.id
    ) then
      return new;
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'Proposal acceptance must go through accept_proposal_at_revision.',
      detail = format(
        'Blocked untrusted completed → booked on proposal %s (no trusted acceptance receipt)',
        new.id
      );
  end if;

  -- First acceptance (and any other non-completed → booked) must be RPC-trusted.
  if not exists (
    select 1
    from public.proposal_accept_transition_trust t
    where t.proposal_id = new.id
      and t.txid = txid_current()
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Proposal acceptance must go through accept_proposal_at_revision.',
      detail = format(
        'Blocked untrusted transition %s → booked on proposal %s',
        old.status,
        new.id
      );
  end if;

  delete from public.proposal_accept_transition_trust
  where proposal_id = new.id;

  return new;
end;
$$;

revoke all on function public.enforce_proposal_accept_via_rpc() from public;
revoke all on function public.enforce_proposal_accept_via_rpc() from anon;
revoke all on function public.enforce_proposal_accept_via_rpc() from authenticated;
revoke all on function public.enforce_proposal_accept_via_rpc() from service_role;

drop trigger if exists enforce_proposal_accept_via_rpc on public.proposals;
create trigger enforce_proposal_accept_via_rpc
  before insert or update on public.proposals
  for each row
  execute function public.enforce_proposal_accept_via_rpc();

-- Preserve 080000 accept behaviour; record immutable trusted-acceptance receipt.
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
    -- Heal receipt only via this trusted RPC (idempotent).
    insert into public.proposal_trusted_acceptances (
      proposal_id,
      content_revision,
      total_amount,
      accepted_at,
      source
    )
    values (
      v_proposal.id,
      coalesce(v_proposal.accepted_content_revision, v_proposal.content_revision, 0),
      coalesce(v_proposal.accepted_total_amount, v_proposal.total_amount, 0),
      coalesce(v_proposal.accepted_at, v_accepted_at),
      'accept_proposal_at_revision_idempotent'
    )
    on conflict (proposal_id) do nothing;

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

  insert into public.proposal_accept_transition_trust (proposal_id, txid)
  values (v_proposal.id, txid_current())
  on conflict (proposal_id) do update
    set txid = excluded.txid;

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
    delete from public.proposal_accept_transition_trust
    where proposal_id = v_proposal.id;
    return jsonb_build_object(
      'ok', false,
      'error', 'This quote has been updated. Please refresh the page and review the new total before accepting.',
      'stale_revision', true
    );
  end if;

  insert into public.proposal_trusted_acceptances (
    proposal_id,
    content_revision,
    total_amount,
    accepted_at,
    source
  )
  values (
    v_proposal.id,
    v_proposal.content_revision,
    v_proposal.total_amount,
    v_accepted_at,
    p_source
  )
  on conflict (proposal_id) do nothing;

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
    delete from public.proposal_accept_transition_trust
    where proposal_id = p_proposal_id;
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
