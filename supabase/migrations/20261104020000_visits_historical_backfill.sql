-- Unified site visits — Milestone 3A historical backfill (additive, idempotent).
-- After 20261104010000_visits_unification_foundation.sql.
-- Never deletes rows. Never overwrites capture notes/photos/checklist/measurements.
-- Ambiguous relationships are logged and left unchanged.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Audit log (safe to re-run; each execution appends a new run_id)
-- ---------------------------------------------------------------------------

create table if not exists public.visits_unification_backfill_log (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  action text not null,
  workspace_id uuid,
  enquiry_id uuid,
  visit_id uuid,
  site_visit_id uuid,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists visits_unification_backfill_log_run_idx
  on public.visits_unification_backfill_log (run_id, action);

comment on table public.visits_unification_backfill_log is
  'Audit trail for visits unification historical backfill. Append-only. Server/migration audit only — not client-exposed.';

-- Deny-by-default: migration audit must not be readable via PostgREST client roles.
-- Rows with workspace_id null (run summaries) must not leak across workspaces.
alter table public.visits_unification_backfill_log enable row level security;
alter table public.visits_unification_backfill_log force row level security;

drop policy if exists "workspace members can read backfill log"
  on public.visits_unification_backfill_log;

revoke all on table public.visits_unification_backfill_log from anon;
revoke all on table public.visits_unification_backfill_log from authenticated;
grant all on table public.visits_unification_backfill_log to service_role;
grant all on table public.visits_unification_backfill_log to postgres;

create or replace function public.reanvil_visit_confirmation_token()
returns text
language plpgsql
as $$
declare
  alphabet constant text :=
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  bytes bytea;
  result text := '';
  i integer;
begin
  bytes := gen_random_bytes(32);
  for i in 0..31 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 62) + 1, 1);
  end loop;
  return result;
end;
$$;

comment on function public.reanvil_visit_confirmation_token() is
  'Server-side opaque token for visits.customer_access_token (Milestone 3A).';

do $$
declare
  run_uuid uuid := gen_random_uuid();
  r record;
  candidate_count integer;
  candidate_id uuid;
  new_visit_id uuid;
  new_token text;
  token_attempts integer;
  derived_date date;
  derived_starts timestamptz;
  derived_status text;
  visit_count_before integer;
  site_visit_count_before integer;
  linked_count integer := 0;
  created_count integer := 0;
  token_count integer := 0;
  skip_ambiguous integer := 0;
  skip_no_date integer := 0;
  skip_already integer := 0;
  fill_datetime integer := 0;
begin
  select count(*) into visit_count_before from public.visits;
  select count(*) into site_visit_count_before from public.site_visits;

  insert into public.visits_unification_backfill_log (run_id, action, detail)
  values (
    run_uuid,
    'run_started',
    format(
      'visits=%s site_visits=%s',
      visit_count_before,
      site_visit_count_before
    )
  );

  -- -------------------------------------------------------------------------
  -- 1) Mint missing confirmation tokens (do not rotate existing tokens)
  -- -------------------------------------------------------------------------
  for r in
    select v.id, v.workspace_id, v.enquiry_id
    from public.visits v
    where v.customer_access_token is null
       or btrim(v.customer_access_token) = ''
  loop
    token_attempts := 0;
    loop
      token_attempts := token_attempts + 1;
      new_token := public.reanvil_visit_confirmation_token();
      begin
        update public.visits
        set customer_access_token = new_token
        where id = r.id
          and (customer_access_token is null or btrim(customer_access_token) = '');
        exit;
      exception
        when unique_violation then
          if token_attempts >= 8 then
            raise exception 'Could not mint unique visit token for visit %', r.id;
          end if;
      end;
    end loop;

    token_count := token_count + 1;
    insert into public.visits_unification_backfill_log (
      run_id, action, workspace_id, enquiry_id, visit_id, detail
    ) values (
      run_uuid, 'mint_token', r.workspace_id, r.enquiry_id, r.id, 'minted missing token'
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- 2) Fill starts_at / slot_label on visits when date exists and fields empty
  --    Does not invent dates.
  -- -------------------------------------------------------------------------
  update public.visits v
  set
    starts_at = coalesce(
      v.starts_at,
      case
        when v.visit_date is not null and v.visit_time ~ '^[0-2][0-9]:[0-5][0-9]$'
          then (v.visit_date::text || 'T' || v.visit_time || ':00.000Z')::timestamptz
        when v.visit_date is not null
          then (v.visit_date::text || 'T00:00:00.000Z')::timestamptz
        else null
      end
    ),
    slot_label = coalesce(
      nullif(btrim(v.slot_label), ''),
      case
        when v.visit_date is not null and coalesce(nullif(btrim(v.visit_time), ''), '') <> ''
          then v.visit_date::text || ' at ' || v.visit_time
        when v.visit_date is not null
          then v.visit_date::text
        else null
      end
    )
  where v.visit_date is not null
    and (v.starts_at is null or v.slot_label is null or btrim(coalesce(v.slot_label, '')) = '');

  get diagnostics fill_datetime = row_count;

  insert into public.visits_unification_backfill_log (run_id, action, detail)
  values (
    run_uuid,
    'fill_visit_datetime',
    format('updated_rows=%s', fill_datetime)
  );

  -- -------------------------------------------------------------------------
  -- 3) Reciprocal link repair (already partially linked)
  -- -------------------------------------------------------------------------
  for r in
    select v.id as visit_id, v.workspace_id, v.enquiry_id, v.source_site_visit_id
    from public.visits v
    join public.site_visits sv on sv.id = v.source_site_visit_id
    where v.source_site_visit_id is not null
      and sv.visit_id is null
      and sv.workspace_id = v.workspace_id
  loop
    update public.site_visits
    set visit_id = r.visit_id
    where id = r.source_site_visit_id
      and visit_id is null;

    linked_count := linked_count + 1;
    insert into public.visits_unification_backfill_log (
      run_id, action, workspace_id, enquiry_id, visit_id, site_visit_id, detail
    ) values (
      run_uuid, 'link_reciprocal_site_to_visit', r.workspace_id, r.enquiry_id,
      r.visit_id, r.source_site_visit_id, 'set site_visits.visit_id from source_site_visit_id'
    );
  end loop;

  for r in
    select sv.id as site_visit_id, sv.workspace_id, sv.enquiry_id, sv.visit_id
    from public.site_visits sv
    join public.visits v on v.id = sv.visit_id
    where sv.visit_id is not null
      and v.source_site_visit_id is null
      and v.workspace_id = sv.workspace_id
  loop
    update public.visits
    set source_site_visit_id = r.site_visit_id
    where id = r.visit_id
      and source_site_visit_id is null;

    linked_count := linked_count + 1;
    insert into public.visits_unification_backfill_log (
      run_id, action, workspace_id, enquiry_id, visit_id, site_visit_id, detail
    ) values (
      run_uuid, 'link_reciprocal_visit_to_site', r.workspace_id, r.enquiry_id,
      r.visit_id, r.site_visit_id, 'set visits.source_site_visit_id from visit_id'
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- 4) Link unlinked site_visits when exactly one matching visit exists
  -- -------------------------------------------------------------------------
  for r in
    select
      sv.id as site_visit_id,
      sv.workspace_id,
      sv.enquiry_id,
      sv.starts_at,
      sv.slot_label,
      sv.date_iso,
      sv.completed_at
    from public.site_visits sv
    where sv.visit_id is null
      and sv.enquiry_id is not null
  loop
    select count(*)::integer, (array_agg(v.id order by v.created_at asc, v.id asc))[1]
    into candidate_count, candidate_id
    from public.visits v
    where v.workspace_id = r.workspace_id
      and v.enquiry_id = r.enquiry_id;

    if candidate_count = 0 then
      -- handled in create-from-capture phase
      continue;
    end if;

    if candidate_count > 1 then
      -- Prefer exact unambiguous datetime match among candidates
      select count(*)::integer, (array_agg(v.id order by v.created_at asc, v.id asc))[1]
      into candidate_count, candidate_id
      from public.visits v
      where v.workspace_id = r.workspace_id
        and v.enquiry_id = r.enquiry_id
        and (
          (r.starts_at is not null and v.starts_at is not null and v.starts_at = r.starts_at)
          or (
            r.date_iso is not null
            and v.visit_date = r.date_iso
            and (
              r.starts_at is null
              or v.starts_at is null
              or v.starts_at = r.starts_at
            )
          )
        );

      if candidate_count <> 1 then
        skip_ambiguous := skip_ambiguous + 1;
        insert into public.visits_unification_backfill_log (
          run_id, action, workspace_id, enquiry_id, site_visit_id, detail
        ) values (
          run_uuid,
          'skip_ambiguous_multiple_visits',
          r.workspace_id,
          r.enquiry_id,
          r.site_visit_id,
          'multiple visits for enquiry; no single unambiguous datetime match'
        );
        continue;
      end if;
    end if;

    update public.site_visits
    set visit_id = candidate_id
    where id = r.site_visit_id
      and visit_id is null;

    update public.visits
    set
      source_site_visit_id = coalesce(source_site_visit_id, r.site_visit_id),
      starts_at = coalesce(starts_at, r.starts_at),
      slot_label = coalesce(nullif(btrim(slot_label), ''), r.slot_label)
    where id = candidate_id
      and workspace_id = r.workspace_id;

    linked_count := linked_count + 1;
    insert into public.visits_unification_backfill_log (
      run_id, action, workspace_id, enquiry_id, visit_id, site_visit_id, detail
    ) values (
      run_uuid, 'link_capture_to_existing_visit', r.workspace_id, r.enquiry_id,
      candidate_id, r.site_visit_id, 'unambiguous enquiry match'
    );
  end loop;

  -- -------------------------------------------------------------------------
  -- 5) Create booking rows from capture-only site_visits (unambiguous only)
  -- -------------------------------------------------------------------------
  for r in
    select
      sv.id as site_visit_id,
      sv.workspace_id,
      sv.enquiry_id,
      sv.starts_at,
      sv.slot_label,
      sv.date_iso,
      sv.completed_at,
      e.customer_id,
      e.customer_name,
      e.customer_mobile,
      e.customer_email,
      e.address_line_1,
      e.address_line_2,
      e.town,
      e.county,
      e.postcode,
      e.project_description,
      e.service_requested,
      e.linked_proposal_id
    from public.site_visits sv
    join public.enquiries e
      on e.id = sv.enquiry_id
     and e.workspace_id = sv.workspace_id
    where sv.visit_id is null
      and sv.enquiry_id is not null
  loop
    select count(*)::integer
    into candidate_count
    from public.visits v
    where v.workspace_id = r.workspace_id
      and v.enquiry_id = r.enquiry_id;

    if candidate_count > 0 then
      -- Either already linked above or ambiguous; do not create another booking.
      skip_already := skip_already + 1;
      insert into public.visits_unification_backfill_log (
        run_id, action, workspace_id, enquiry_id, site_visit_id, detail
      ) values (
        run_uuid,
        'skip_create_visit_exists',
        r.workspace_id,
        r.enquiry_id,
        r.site_visit_id,
        format('visits_for_enquiry=%s; left unchanged', candidate_count)
      );
      continue;
    end if;

    derived_date := coalesce(r.date_iso, (r.starts_at at time zone 'utc')::date);
    if derived_date is null then
      skip_no_date := skip_no_date + 1;
      insert into public.visits_unification_backfill_log (
        run_id, action, workspace_id, enquiry_id, site_visit_id, detail
      ) values (
        run_uuid,
        'skip_no_date',
        r.workspace_id,
        r.enquiry_id,
        r.site_visit_id,
        'capture-only site_visit has no date_iso/starts_at; not inventing a date'
      );
      continue;
    end if;

    derived_starts := coalesce(
      r.starts_at,
      (derived_date::text || 'T00:00:00.000Z')::timestamptz
    );
    derived_status := case
      when r.completed_at is not null then 'completed'
      else 'scheduled'
    end;

    token_attempts := 0;
    new_visit_id := null;
    loop
      token_attempts := token_attempts + 1;
      new_token := public.reanvil_visit_confirmation_token();
      begin
        insert into public.visits (
          workspace_id,
          customer_id,
          enquiry_id,
          customer_name,
          contact_phone,
          contact_email,
          address_line_1,
          address_line_2,
          town,
          county,
          postcode,
          enquiry_summary,
          visit_type,
          visit_date,
          visit_time,
          duration_minutes,
          status,
          notes,
          linked_proposal_id,
          customer_access_token,
          starts_at,
          slot_label,
          source_site_visit_id
        ) values (
          r.workspace_id,
          r.customer_id,
          r.enquiry_id,
          coalesce(nullif(btrim(r.customer_name), ''), 'Customer'),
          coalesce(r.customer_mobile, ''),
          coalesce(r.customer_email, ''),
          coalesce(r.address_line_1, ''),
          coalesce(r.address_line_2, ''),
          coalesce(r.town, ''),
          coalesce(r.county, ''),
          coalesce(r.postcode, ''),
          nullif(btrim(concat_ws(E'\n\n', r.service_requested, r.project_description)), ''),
          'initial_assessment',
          derived_date,
          case
            when r.starts_at is not null
              then to_char(timezone('UTC', r.starts_at), 'HH24:MI')
            else null
          end,
          60,
          derived_status,
          '',
          r.linked_proposal_id,
          new_token,
          derived_starts,
          coalesce(nullif(btrim(r.slot_label), ''), derived_date::text),
          r.site_visit_id
        )
        returning id into new_visit_id;
        exit;
      exception
        when unique_violation then
          -- Token collision: retry. Active-initial collision: skip as ambiguous.
          if token_attempts >= 8 then
            skip_ambiguous := skip_ambiguous + 1;
            insert into public.visits_unification_backfill_log (
              run_id, action, workspace_id, enquiry_id, site_visit_id, detail
            ) values (
              run_uuid,
              'skip_create_unique_violation',
              r.workspace_id,
              r.enquiry_id,
              r.site_visit_id,
              'unique constraint prevented create; left unchanged'
            );
            new_visit_id := null;
            exit;
          end if;
      end;
    end loop;

    if new_visit_id is null then
      continue;
    end if;

    update public.site_visits
    set visit_id = new_visit_id
    where id = r.site_visit_id
      and visit_id is null;

    created_count := created_count + 1;
    token_count := token_count + 1;
    insert into public.visits_unification_backfill_log (
      run_id, action, workspace_id, enquiry_id, visit_id, site_visit_id, detail
    ) values (
      run_uuid,
      'create_visit_from_capture',
      r.workspace_id,
      r.enquiry_id,
      new_visit_id,
      r.site_visit_id,
      format('status=%s date=%s', derived_status, derived_date)
    );
  end loop;

  insert into public.visits_unification_backfill_log (run_id, action, detail)
  values (
    run_uuid,
    'run_completed',
    format(
      'linked=%s created_visits=%s tokens_minted=%s skip_ambiguous=%s skip_no_date=%s skip_create_visit_exists=%s fill_datetime_rows=%s visits_after=%s site_visits_after=%s',
      linked_count,
      created_count,
      token_count,
      skip_ambiguous,
      skip_no_date,
      skip_already,
      fill_datetime,
      (select count(*) from public.visits),
      (select count(*) from public.site_visits)
    )
  );

  raise notice 'visits_unification_backfill run_id=% linked=% created=% tokens=% ambiguous=% no_date=%',
    run_uuid, linked_count, created_count, token_count, skip_ambiguous, skip_no_date;
end $$;
