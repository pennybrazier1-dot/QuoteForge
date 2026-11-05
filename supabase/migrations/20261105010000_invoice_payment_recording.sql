-- Stage 9B: allow recording payment against an approved invoice.
-- Approved priced content stays immutable; amount_paid / balance_due may update.

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
    then
      raise exception 'Approved invoices cannot be rewritten';
    end if;
  end if;
  return new;
end;
$$;
