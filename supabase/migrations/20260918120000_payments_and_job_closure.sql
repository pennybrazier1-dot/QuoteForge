-- Phase 50H.1 — workspace payment settings, job payment state, closed jobs.
-- Bank details live in a dedicated table so ordinary workspace/proposal
-- selects cannot accidentally return them.

create table public.workspace_payment_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  accept_bank_transfer boolean not null default false,
  accept_card_link boolean not null default false,
  accept_card_in_person boolean not null default false,
  accept_cash boolean not null default false,
  accept_other boolean not null default false,
  bank_account_name text,
  bank_sort_code text,
  bank_account_number text,
  bank_reference_instructions text,
  external_payment_url text,
  other_method_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workspace_payment_settings is
  'Trader payment methods and bank details. Never expose on public enquiry or unrelated pages.';

create trigger set_workspace_payment_settings_updated_at
before update on public.workspace_payment_settings
for each row
execute function public.set_updated_at();

alter table public.workspace_payment_settings enable row level security;

create policy "Users can view payment settings in their workspace"
  on public.workspace_payment_settings for select
  to authenticated
  using (workspace_id = public.current_workspace_id());

create policy "Users can insert payment settings in their workspace"
  on public.workspace_payment_settings for insert
  to authenticated
  with check (workspace_id = public.current_workspace_id());

create policy "Users can update payment settings in their workspace"
  on public.workspace_payment_settings for update
  to authenticated
  using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

revoke all on table public.workspace_payment_settings from public, anon;
grant select, insert, update on table public.workspace_payment_settings to authenticated;

alter table public.proposals
  add column if not exists payment_status text not null default 'not_requested',
  add column if not exists payment_requested_at timestamptz,
  add column if not exists payment_due_amount integer,
  add column if not exists payment_methods_issued text[] not null default '{}',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists payment_provider text,
  add column if not exists payment_provider_reference text,
  add column if not exists closed_at timestamptz,
  add column if not exists issued_bank_account_name text,
  add column if not exists issued_bank_sort_code text,
  add column if not exists issued_bank_account_number text,
  add column if not exists issued_bank_reference text,
  add column if not exists issued_payment_url text;

alter table public.proposals
  drop constraint if exists proposals_payment_status_check;

alter table public.proposals
  add constraint proposals_payment_status_check
  check (
    payment_status in ('not_requested', 'requested', 'paid', 'waived')
  );

alter table public.proposals
  drop constraint if exists proposals_payment_due_amount_check;

alter table public.proposals
  add constraint proposals_payment_due_amount_check
  check (payment_due_amount is null or payment_due_amount >= 0);

comment on column public.proposals.payment_status is
  'Separate from job status. completed ≠ paid. closed requires paid or waived.';
comment on column public.proposals.issued_bank_account_number is
  'Snapshot copied when a payment request is issued. Never log. Hide after paid.';
comment on column public.proposals.payment_provider_reference is
  'Reserved for a future card-provider webhook. Do not fake confirmation.';

alter table public.proposals
  drop constraint if exists proposals_status_check;

alter table public.proposals
  add constraint proposals_status_check
  check (
    status in (
      'draft',
      'ready_to_send',
      'waiting_for_customer',
      'needs_attention',
      'booked',
      'completed',
      'cancelled',
      'invoiced',
      'paid',
      'closed',
      'declined',
      'expired'
    )
  );

comment on column public.workspaces.public_enquiry_slug is
  'Public token for /t/{slug} and /request-quote/w/{slug}. Never encode private workspace IDs, tokens, or payment details in QR codes.';
