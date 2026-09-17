-- Phase 50G.8: ensure every accepted + date-confirmed booked job has an
-- Active Customer, then link the existing proposal/job/visit/enquiry.

-- 1. Reuse an existing workspace customer by email.
update public.proposals as proposal
set customer_id = matched.id
from public.customers as matched
where proposal.customer_id is null
  and (
    proposal.accepted_at is not null
    or proposal.status in ('booked', 'completed')
  )
  and proposal.booking_confirmation = 'confirmed'
  and exists (
    select 1
    from public.jobs as job
    where job.proposal_id = proposal.id
  )
  and proposal.customer_email is not null
  and length(trim(proposal.customer_email)) > 0
  and matched.workspace_id = proposal.workspace_id
  and matched.anonymised_at is null
  and matched.email is not null
  and lower(trim(matched.email)) = lower(trim(proposal.customer_email));

-- 2. Reuse an existing workspace customer by normalised phone.
update public.proposals as proposal
set customer_id = matched.id
from public.customers as matched
where proposal.customer_id is null
  and (
    proposal.accepted_at is not null
    or proposal.status in ('booked', 'completed')
  )
  and proposal.booking_confirmation = 'confirmed'
  and exists (
    select 1
    from public.jobs as job
    where job.proposal_id = proposal.id
  )
  and proposal.customer_phone is not null
  and length(regexp_replace(proposal.customer_phone, '\D', '', 'g')) >= 7
  and matched.workspace_id = proposal.workspace_id
  and matched.anonymised_at is null
  and matched.phone is not null
  and regexp_replace(matched.phone, '\D', '', 'g')
    = regexp_replace(proposal.customer_phone, '\D', '', 'g');

-- 3. Create a customer for each remaining booked job and link it immediately.
--    One proposal → one insert, so missing email/phone cannot create orphans.
do $$
declare
  booked record;
  new_customer_id uuid;
begin
  for booked in
    select
      proposal.id,
      proposal.workspace_id,
      proposal.customer_name,
      proposal.customer_email,
      proposal.customer_phone,
      proposal.customer_address,
      proposal.job_address,
      proposal.accepted_at
    from public.proposals as proposal
    where proposal.customer_id is null
      and (
        proposal.accepted_at is not null
        or proposal.status in ('booked', 'completed')
      )
      and proposal.booking_confirmation = 'confirmed'
      and exists (
        select 1
        from public.jobs as job
        where job.proposal_id = proposal.id
      )
  loop
    insert into public.customers (
      workspace_id,
      name,
      email,
      phone,
      address_line_1,
      activated_at
    )
    values (
      booked.workspace_id,
      coalesce(nullif(trim(booked.customer_name), ''), 'Customer'),
      nullif(trim(booked.customer_email), ''),
      nullif(trim(booked.customer_phone), ''),
      coalesce(
        nullif(trim(booked.customer_address), ''),
        nullif(trim(booked.job_address), '')
      ),
      coalesce(booked.accepted_at, now())
    )
    returning id into new_customer_id;

    update public.proposals
    set customer_id = new_customer_id
    where id = booked.id;
  end loop;
end $$;

-- 4. Activate linked customers who now have a booked job.
--    Do not un-archive or cancel a deletion window.
update public.customers as customer
set activated_at = coalesce(customer.activated_at, customer.created_at, now())
where customer.anonymised_at is null
  and customer.archived_at is null
  and customer.deletion_requested_at is null
  and exists (
    select 1
    from public.proposals as proposal
    where proposal.customer_id = customer.id
      and (
        proposal.accepted_at is not null
        or proposal.status in ('booked', 'completed')
      )
      and proposal.booking_confirmation = 'confirmed'
      and exists (
        select 1
        from public.jobs as job
        where job.proposal_id = proposal.id
      )
  );

-- 5. Link jobs, visits, and enquiries to the booked-job customer.
update public.jobs as job
set customer_id = proposal.customer_id
from public.proposals as proposal
where job.proposal_id = proposal.id
  and proposal.customer_id is not null
  and (job.customer_id is null or job.customer_id is distinct from proposal.customer_id);

update public.visits as visit
set customer_id = proposal.customer_id
from public.proposals as proposal
where visit.linked_proposal_id = proposal.id
  and proposal.customer_id is not null
  and (visit.customer_id is null or visit.customer_id is distinct from proposal.customer_id);

update public.enquiries as enquiry
set customer_id = proposal.customer_id
from public.proposals as proposal
where enquiry.linked_proposal_id = proposal.id
  and proposal.customer_id is not null
  and (enquiry.customer_id is null or enquiry.customer_id is distinct from proposal.customer_id);
