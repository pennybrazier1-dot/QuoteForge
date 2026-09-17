-- Phase 50G.7: correct Active Customers from accepted/booked work.
-- The first lifecycle backfill activated anyone with a job, or a proposal
-- whose status was booked/completed, even when accepted_at was missing.
-- It also only looked at customers already linked via proposal.customer_id,
-- so accepted/booked proposals created after quote-save stopped creating
-- customers were never turned into Active Customers.

-- 1. Reuse an existing workspace customer by email when the proposal is
--    accepted and booked/completed/has a job, but customer_id is empty.
update public.proposals as proposal
set customer_id = matched.id
from public.customers as matched
where proposal.customer_id is null
  and proposal.accepted_at is not null
  and proposal.customer_email is not null
  and length(trim(proposal.customer_email)) > 0
  and (
    proposal.booking_confirmation = 'confirmed'
    or proposal.status = 'completed'
    or exists (
      select 1
      from public.jobs as job
      where job.proposal_id = proposal.id
    )
  )
  and matched.workspace_id = proposal.workspace_id
  and matched.anonymised_at is null
  and matched.email is not null
  and lower(trim(matched.email)) = lower(trim(proposal.customer_email));

-- 2. Create missing Active Customers from qualifying proposal contact data.
insert into public.customers (
  workspace_id,
  name,
  email,
  phone,
  address_line_1,
  activated_at
)
select
  proposal.workspace_id,
  coalesce(nullif(trim(proposal.customer_name), ''), 'Customer'),
  nullif(trim(proposal.customer_email), ''),
  nullif(trim(proposal.customer_phone), ''),
  coalesce(
    nullif(trim(proposal.customer_address), ''),
    nullif(trim(proposal.job_address), '')
  ),
  coalesce(proposal.accepted_at, now())
from public.proposals as proposal
where proposal.accepted_at is not null
  and proposal.customer_id is null
  and (
    proposal.booking_confirmation = 'confirmed'
    or proposal.status = 'completed'
    or exists (
      select 1
      from public.jobs as job
      where job.proposal_id = proposal.id
    )
  )
  and not exists (
    select 1
    from public.customers as existing
    where existing.workspace_id = proposal.workspace_id
      and existing.anonymised_at is null
      and existing.email is not null
      and proposal.customer_email is not null
      and lower(trim(existing.email)) = lower(trim(proposal.customer_email))
  );

-- 3. Link those newly created (or previously unmatched) rows.
update public.proposals as proposal
set customer_id = matched.id
from public.customers as matched
where proposal.customer_id is null
  and proposal.accepted_at is not null
  and proposal.customer_email is not null
  and length(trim(proposal.customer_email)) > 0
  and matched.workspace_id = proposal.workspace_id
  and matched.anonymised_at is null
  and matched.email is not null
  and lower(trim(matched.email)) = lower(trim(proposal.customer_email));

update public.jobs as job
set customer_id = proposal.customer_id
from public.proposals as proposal
where job.proposal_id = proposal.id
  and proposal.customer_id is not null
  and (job.customer_id is null or job.customer_id is distinct from proposal.customer_id);

-- 4. Activate customers who now have qualifying accepted/booked work.
update public.customers as customer
set
  activated_at = coalesce(customer.activated_at, customer.created_at, now()),
  archived_at = case
    when customer.deletion_requested_at is null then null
    else customer.archived_at
  end
where customer.anonymised_at is null
  and customer.deletion_requested_at is null
  and exists (
    select 1
    from public.proposals as proposal
    where proposal.customer_id = customer.id
      and proposal.accepted_at is not null
      and (
        proposal.booking_confirmation = 'confirmed'
        or proposal.status = 'completed'
        or exists (
          select 1
          from public.jobs as job
          where job.proposal_id = proposal.id
        )
      )
  );

-- 5. Undo the first loose backfill: quote-only / unaccepted contacts who were
--    marked Active because they had any job or a booked-looking status.
update public.customers as customer
set activated_at = null
where customer.activated_at is not null
  and customer.archived_at is null
  and customer.deletion_requested_at is null
  and customer.anonymised_at is null
  and exists (
    select 1
    from public.proposals as proposal
    where proposal.customer_id = customer.id
  )
  and not exists (
    select 1
    from public.proposals as proposal
    where proposal.customer_id = customer.id
      and proposal.accepted_at is not null
      and (
        proposal.booking_confirmation = 'confirmed'
        or proposal.status = 'completed'
        or exists (
          select 1
          from public.jobs as job
          where job.proposal_id = proposal.id
        )
      )
  );
