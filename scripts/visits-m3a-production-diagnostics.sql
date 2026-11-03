-- READ-ONLY Production diagnostics for visits unification backfill.
-- Do NOT run with write privileges. Do NOT apply migrations from this file.
-- Requires explicit approval before use against Production.

-- 1) Counts
select 'visits' as entity, count(*)::bigint as n from public.visits
union all
select 'site_visits', count(*)::bigint from public.site_visits
union all
select 'visits_without_token', count(*)::bigint
from public.visits
where customer_access_token is null or btrim(customer_access_token) = ''
union all
select 'site_visits_without_visit_id', count(*)::bigint
from public.site_visits
where visit_id is null
union all
select 'site_visits_without_date', count(*)::bigint
from public.site_visits
where visit_id is null
  and date_iso is null
  and starts_at is null;

-- 2) Dual-table enquiries
select
  sv.workspace_id,
  sv.enquiry_id,
  count(distinct sv.id) as site_visit_rows,
  count(distinct v.id) as visit_rows
from public.site_visits sv
left join public.visits v
  on v.enquiry_id = sv.enquiry_id
 and v.workspace_id = sv.workspace_id
group by sv.workspace_id, sv.enquiry_id
having count(distinct v.id) > 0
order by visit_rows desc, site_visit_rows desc
limit 100;

-- 3) Ambiguous: multiple visits per enquiry with unlinked capture
select
  sv.enquiry_id,
  sv.workspace_id,
  count(distinct v.id) as visit_rows,
  count(distinct sv.id) as unlinked_site_visits
from public.site_visits sv
join public.visits v
  on v.enquiry_id = sv.enquiry_id
 and v.workspace_id = sv.workspace_id
where sv.visit_id is null
group by sv.enquiry_id, sv.workspace_id
having count(distinct v.id) > 1
order by visit_rows desc
limit 100;

-- 4) Capture-only candidates (may become created visits if dated)
select
  sv.id as site_visit_id,
  sv.workspace_id,
  sv.enquiry_id,
  sv.date_iso,
  sv.starts_at,
  sv.completed_at is not null as is_completed,
  length(coalesce(sv.notes, '')) as notes_len,
  (select count(*) from public.enquiry_media m where m.site_visit_id = sv.id) as media_count
from public.site_visits sv
where sv.visit_id is null
  and not exists (
    select 1
    from public.visits v
    where v.enquiry_id = sv.enquiry_id
      and v.workspace_id = sv.workspace_id
  )
order by sv.created_at asc
limit 200;

-- 5) Active initial duplicates (must be zero before unique index / careful before prod apply)
select enquiry_id, workspace_id, count(*) as active_initial_visits
from public.visits
where enquiry_id is not null
  and visit_type = 'initial_assessment'
  and status not in ('cancelled', 'no_show')
group by enquiry_id, workspace_id
having count(*) > 1;
