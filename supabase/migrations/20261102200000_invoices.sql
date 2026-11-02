-- Stage 1: invoice drafts linked 1:1 to a completed job (proposal).
-- Local migration only until Stage release. Do not invent VAT or line prices.

alter table public.workspaces
  add column if not exists invoice_number_prefix text not null default 'INV',
  add column if not exists next_invoice_number integer not null default 1
    check (next_invoice_number > 0);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft' check (
    status in ('draft', 'approved', 'void')
  ),
  currency text not null default 'GBP' check (char_length(currency) = 3),
  business_name text,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_address text,
  job_title text not null,
  job_address text,
  work_description text,
  line_items jsonb not null default '[]'::jsonb,
  flags jsonb not null default '[]'::jsonb,
  notes text,
  subtotal_amount integer not null default 0 check (subtotal_amount >= 0),
  vat_amount integer not null default 0 check (vat_amount >= 0),
  total_amount integer not null default 0 check (total_amount >= 0),
  amount_paid integer not null default 0 check (amount_paid >= 0),
  balance_due integer not null default 0 check (balance_due >= 0),
  -- Stage 1B: snapshot agreed quote total / source VAT for approval safety.
  agreed_total_amount integer not null default 0 check (agreed_total_amount >= 0),
  source_vat_amount integer not null default 0 check (source_vat_amount >= 0),
  adjustment_confirmed boolean not null default false,
  tax_confirmed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (proposal_id),
  unique (workspace_id, invoice_number)
);

comment on table public.invoices is
  'One invoice per job/proposal. Drafts are editable; approved snapshots are immutable.';

comment on column public.invoices.flags is
  'Correction flags such as missing_line_prices. Never invent missing amounts.';

create index if not exists invoices_workspace_status_idx
  on public.invoices (workspace_id, status, created_at desc);

create index if not exists invoices_workspace_proposal_idx
  on public.invoices (workspace_id, proposal_id);

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

create or replace function public.prevent_approved_invoice_rewrite()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'approved' and new.status = 'approved' then
    if new.line_items is distinct from old.line_items
      or new.subtotal_amount is distinct from old.subtotal_amount
      or new.vat_amount is distinct from old.vat_amount
      or new.total_amount is distinct from old.total_amount
      or new.amount_paid is distinct from old.amount_paid
      or new.balance_due is distinct from old.balance_due
      or new.customer_name is distinct from old.customer_name
      or new.customer_email is distinct from old.customer_email
      or new.customer_phone is distinct from old.customer_phone
      or new.customer_address is distinct from old.customer_address
      or new.job_title is distinct from old.job_title
      or new.job_address is distinct from old.job_address
      or new.work_description is distinct from old.work_description
      or new.invoice_number is distinct from old.invoice_number
      or new.currency is distinct from old.currency
      or new.agreed_total_amount is distinct from old.agreed_total_amount
      or new.source_vat_amount is distinct from old.source_vat_amount
      or new.notes is distinct from old.notes
      or new.flags is distinct from old.flags
    then
      raise exception 'Approved invoices cannot be rewritten';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_approved_invoice_rewrite on public.invoices;
create trigger prevent_approved_invoice_rewrite
before update on public.invoices
for each row
execute function public.prevent_approved_invoice_rewrite();

create or replace function public.allocate_invoice_number(target_workspace_id uuid)
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
    raise exception 'Not authorised to allocate invoice numbers for this workspace';
  end if;

  select *
  into workspace_record
  from public.workspaces
  where id = target_workspace_id
  for update;

  if not found then
    raise exception 'Workspace not found';
  end if;

  formatted_number := coalesce(nullif(workspace_record.invoice_number_prefix, ''), 'INV')
    || '-'
    || to_char(now(), 'YYYY')
    || '-'
    || lpad(workspace_record.next_invoice_number::text, 4, '0');

  update public.workspaces
  set next_invoice_number = next_invoice_number + 1
  where id = target_workspace_id;

  return formatted_number;
end;
$$;

revoke all on function public.allocate_invoice_number(uuid) from public;
grant execute on function public.allocate_invoice_number(uuid) to authenticated;

alter table public.invoices enable row level security;

drop policy if exists "Users can view invoices in their workspace" on public.invoices;
create policy "Users can view invoices in their workspace"
  on public.invoices for select
  to authenticated
  using (workspace_id = public.current_workspace_id());

drop policy if exists "Users can create invoices in their workspace" on public.invoices;
create policy "Users can create invoices in their workspace"
  on public.invoices for insert
  to authenticated
  with check (workspace_id = public.current_workspace_id());

drop policy if exists "Users can update invoices in their workspace" on public.invoices;
create policy "Users can update invoices in their workspace"
  on public.invoices for update
  to authenticated
  using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

drop policy if exists "Users can delete draft invoices in their workspace" on public.invoices;
create policy "Users can delete draft invoices in their workspace"
  on public.invoices for delete
  to authenticated
  using (
    workspace_id = public.current_workspace_id()
    and status = 'draft'
  );

revoke all on table public.invoices from public, anon;
grant select, insert, update, delete on table public.invoices to authenticated;
