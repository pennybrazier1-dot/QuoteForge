-- Stage 9I.3a: immutable business branding snapshot on approved invoices.
-- Additive only. Do NOT rewrite historical approved rows.
--
-- Semantics:
--   business_snapshot_at IS NULL  → legacy invoice (pre-9I.3a).
--     PDF loaders MUST fall back to live workspace branding (documented).
--   business_snapshot_at IS NOT NULL → approved branding frozen at approve time.
--     PDF loaders MUST use issued_* fields + issued_logo_path (never live logo).
--
-- Logo bytes are copied at approve into:
--   {workspace_id}/invoice-branding/{invoice_id}/logo.{ext}
-- under the private site-visit-photos bucket (same workspace-scoped RLS).
--
-- NOT APPLIED until explicitly approved for the local database.
-- Do not run against Production from this stage.

alter table public.invoices
  add column if not exists issued_address_line_1 text,
  add column if not exists issued_address_line_2 text,
  add column if not exists issued_town text,
  add column if not exists issued_county text,
  add column if not exists issued_postcode text,
  add column if not exists issued_phone text,
  add column if not exists issued_email text,
  add column if not exists issued_vat_number text,
  add column if not exists issued_website text,
  add column if not exists issued_company_number text,
  add column if not exists issued_logo_path text,
  add column if not exists business_snapshot_at timestamptz;

comment on column public.invoices.issued_address_line_1 is
  'Business address line 1 frozen at invoice approval. Null with null business_snapshot_at = legacy.';
comment on column public.invoices.issued_address_line_2 is
  'Business address line 2 frozen at invoice approval.';
comment on column public.invoices.issued_town is
  'Business town frozen at invoice approval.';
comment on column public.invoices.issued_county is
  'Business county frozen at invoice approval.';
comment on column public.invoices.issued_postcode is
  'Business postcode frozen at invoice approval.';
comment on column public.invoices.issued_phone is
  'Business phone frozen at invoice approval.';
comment on column public.invoices.issued_email is
  'Business email frozen at invoice approval.';
comment on column public.invoices.issued_vat_number is
  'VAT registration frozen at invoice approval. Null means none at approval.';
comment on column public.invoices.issued_website is
  'Website frozen at invoice approval.';
comment on column public.invoices.issued_company_number is
  'Company registration number frozen at invoice approval.';
comment on column public.invoices.issued_logo_path is
  'Private storage path of logo bytes copied at approval. Null = no logo at approval (do not use live logo).';
comment on column public.invoices.business_snapshot_at is
  'When branding snapshot was captured (approve time). Null = legacy pre-9I.3a invoice.';

-- Extend immutability: once approved, branding snapshot + business_name cannot change.
-- amount_paid / balance_due remain writable for payment recording.
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
      or new.business_name is distinct from old.business_name
      or new.issued_address_line_1 is distinct from old.issued_address_line_1
      or new.issued_address_line_2 is distinct from old.issued_address_line_2
      or new.issued_town is distinct from old.issued_town
      or new.issued_county is distinct from old.issued_county
      or new.issued_postcode is distinct from old.issued_postcode
      or new.issued_phone is distinct from old.issued_phone
      or new.issued_email is distinct from old.issued_email
      or new.issued_vat_number is distinct from old.issued_vat_number
      or new.issued_website is distinct from old.issued_website
      or new.issued_company_number is distinct from old.issued_company_number
      or new.issued_logo_path is distinct from old.issued_logo_path
      or new.business_snapshot_at is distinct from old.business_snapshot_at
    then
      raise exception 'Approved invoices cannot be rewritten';
    end if;
  end if;
  return new;
end;
$$;
