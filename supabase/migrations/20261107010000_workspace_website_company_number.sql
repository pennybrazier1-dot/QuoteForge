-- Stage 9I.2: optional website + UK company registration on workspaces.
-- Additive only (nullable text columns). Approved for local application.
-- Do not run against Production from this stage.

alter table public.workspaces
  add column if not exists website text,
  add column if not exists company_number text;

comment on column public.workspaces.website is
  'Optional business website URL. Empty means omit from customer documents.';
comment on column public.workspaces.company_number is
  'Optional UK Companies House number. Empty means omit from customer documents.';
