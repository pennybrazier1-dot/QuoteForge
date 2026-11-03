-- Stage 2L follow-up: optional clear of pending_date_suggestion inside the
-- locked schedule writer so accept-alternative is atomic with the slot move.

create or replace function public.write_proposal_schedule_slot(
  p_proposal_id uuid,
  p_planned_start_date date,
  p_planned_start_time text,
  p_planned_start_date_text text,
  p_booking_confirmation text,
  p_next_status text default null,
  p_attention_reason text default null,
  p_estimated_duration text default null,
  p_require_available boolean default true,
  p_clear_pending_date_suggestion boolean default false
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
    attention_reason = p_attention_reason,
    pending_date_suggestion = case
      when p_clear_pending_date_suggestion then null
      else pending_date_suggestion
    end
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

-- Drop prior 9-arg overload if present so callers resolve to the new signature.
drop function if exists public.write_proposal_schedule_slot(
  uuid, date, text, text, text, text, text, text, boolean
);

revoke all on function public.write_proposal_schedule_slot(
  uuid, date, text, text, text, text, text, text, boolean, boolean
) from public;
revoke all on function public.write_proposal_schedule_slot(
  uuid, date, text, text, text, text, text, text, boolean, boolean
) from anon;
grant execute on function public.write_proposal_schedule_slot(
  uuid, date, text, text, text, text, text, text, boolean, boolean
) to authenticated;
grant execute on function public.write_proposal_schedule_slot(
  uuid, date, text, text, text, text, text, text, boolean, boolean
) to service_role;
