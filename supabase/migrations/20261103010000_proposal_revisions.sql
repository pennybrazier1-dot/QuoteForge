-- Stage 2G: durable proposal revision history + unsent-revision accept lock.
-- Local migration only — do not apply to production until an authorised release stage.

alter table public.proposals
  add column if not exists content_revision integer not null default 0
    check (content_revision >= 0);

alter table public.proposals
  add column if not exists unsent_revision_at timestamptz;

comment on column public.proposals.content_revision is
  'Monotonic content version. Advanced on each saved revision. Used for optimistic concurrency.';

comment on column public.proposals.unsent_revision_at is
  'When set, a revised quote is saved but not yet issued to the customer. Customer acceptance must be refused server-side.';

create table if not exists public.proposal_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  previous_scope_of_work text,
  previous_job_summary text,
  previous_materials jsonb not null default '[]'::jsonb,
  previous_labour jsonb not null default '[]'::jsonb,
  previous_labour_description text,
  previous_subtotal_amount integer not null check (previous_subtotal_amount >= 0),
  previous_vat_amount integer not null check (previous_vat_amount >= 0),
  previous_total_amount integer not null check (previous_total_amount >= 0),
  new_scope_of_work text,
  new_job_summary text,
  new_materials jsonb not null default '[]'::jsonb,
  new_labour jsonb not null default '[]'::jsonb,
  new_labour_description text,
  new_subtotal_amount integer not null check (new_subtotal_amount >= 0),
  new_vat_amount integer not null check (new_vat_amount >= 0),
  new_total_amount integer not null check (new_total_amount >= 0),
  change_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (proposal_id, revision_number),
  check (new_total_amount = new_subtotal_amount + new_vat_amount)
);

create index if not exists proposal_revisions_workspace_id_idx
  on public.proposal_revisions (workspace_id, created_at desc);

create index if not exists proposal_revisions_proposal_id_idx
  on public.proposal_revisions (proposal_id, revision_number desc);

comment on table public.proposal_revisions is
  'Immutable history of proposal content revisions. Live proposals row holds the current authoritative quote.';

alter table public.proposal_revisions enable row level security;

create policy "Users can view proposal revisions in their workspace"
on public.proposal_revisions
for select
to authenticated
using (workspace_id = public.current_workspace_id());

-- Inserts happen only via save_proposal_revision (security definer).
-- No direct insert/update/delete policies for authenticated clients.

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
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'You must be signed in.');
  end if;

  select workspace_id
  into v_workspace_id
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

  select *
  into v_proposal
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

  -- Preserve existing VAT treatment: revised VAT must match current VAT.
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
    status = 'needs_attention'
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
