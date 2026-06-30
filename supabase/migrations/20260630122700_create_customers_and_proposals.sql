-- QuoteForge core product tables:
-- - customers
-- - proposals
-- - atomic proposal numbering
-- - workspace-scoped Row Level Security

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address_line_1 text,
  address_line_2 text,
  town text,
  county text,
  postcode text,
  country text not null default 'United Kingdom',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_workspace_id_idx on public.customers(workspace_id);
create index customers_workspace_name_idx on public.customers(workspace_id, name);

create trigger set_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  proposal_number text not null,
  status text not null default 'draft' check (
    status in ('draft', 'sent', 'accepted', 'declined', 'expired')
  ),
  title text not null,
  job_address text,
  rough_notes text,
  scope_of_work text,
  materials jsonb not null default '[]'::jsonb,
  labour jsonb not null default '[]'::jsonb,
  optional_extras jsonb not null default '[]'::jsonb,
  things_to_confirm text,
  payment_terms text,
  notes_and_exclusions text,
  -- Snapshot of customer details at proposal time so historical documents stay accurate.
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_address text,
  subtotal_amount integer not null default 0 check (subtotal_amount >= 0),
  vat_amount integer not null default 0 check (vat_amount >= 0),
  total_amount integer not null default 0 check (total_amount >= 0),
  currency text not null default 'GBP' check (char_length(currency) = 3),
  sent_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, proposal_number)
);

comment on column public.proposals.total_amount is
  'Proposal total in the smallest currency unit. For GBP this is pence.';

create index proposals_workspace_id_idx on public.proposals(workspace_id);
create index proposals_customer_id_idx on public.proposals(customer_id);
create index proposals_workspace_status_idx on public.proposals(workspace_id, status);
create index proposals_workspace_created_at_idx on public.proposals(workspace_id, created_at desc);

create trigger set_proposals_updated_at
before update on public.proposals
for each row
execute function public.set_updated_at();

-- Atomically allocates the next proposal number for a workspace.
-- Must be called from the server, never from client-side numbering logic.
create or replace function public.allocate_proposal_number(target_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_record public.workspaces%rowtype;
  formatted_number text;
begin
  if target_workspace_id is distinct from public.current_workspace_id() then
    raise exception 'Not authorised to allocate proposal numbers for this workspace';
  end if;

  select *
  into workspace_record
  from public.workspaces
  where id = target_workspace_id
  for update;

  if not found then
    raise exception 'Workspace not found';
  end if;

  formatted_number := workspace_record.proposal_number_prefix
    || '-'
    || to_char(now(), 'YYYY')
    || '-'
    || lpad(workspace_record.next_proposal_number::text, 4, '0');

  update public.workspaces
  set next_proposal_number = next_proposal_number + 1
  where id = target_workspace_id;

  return formatted_number;
end;
$$;

revoke all on function public.allocate_proposal_number(uuid) from public;
grant execute on function public.allocate_proposal_number(uuid) to authenticated;

alter table public.customers enable row level security;
alter table public.proposals enable row level security;

create policy "Users can view customers in their workspace"
on public.customers
for select
to authenticated
using (workspace_id = public.current_workspace_id());

create policy "Users can create customers in their workspace"
on public.customers
for insert
to authenticated
with check (workspace_id = public.current_workspace_id());

create policy "Users can update customers in their workspace"
on public.customers
for update
to authenticated
using (workspace_id = public.current_workspace_id())
with check (workspace_id = public.current_workspace_id());

create policy "Users can delete customers in their workspace"
on public.customers
for delete
to authenticated
using (workspace_id = public.current_workspace_id());

create policy "Users can view proposals in their workspace"
on public.proposals
for select
to authenticated
using (workspace_id = public.current_workspace_id());

create policy "Users can create proposals in their workspace"
on public.proposals
for insert
to authenticated
with check (
  workspace_id = public.current_workspace_id()
  and (
    customer_id is null
    or customer_id in (
      select customers.id
      from public.customers
      where customers.workspace_id = proposals.workspace_id
    )
  )
);

create policy "Users can update proposals in their workspace"
on public.proposals
for update
to authenticated
using (workspace_id = public.current_workspace_id())
with check (
  workspace_id = public.current_workspace_id()
  and (
    customer_id is null
    or customer_id in (
      select customers.id
      from public.customers
      where customers.workspace_id = proposals.workspace_id
    )
  )
);

create policy "Users can delete proposals in their workspace"
on public.proposals
for delete
to authenticated
using (workspace_id = public.current_workspace_id());
