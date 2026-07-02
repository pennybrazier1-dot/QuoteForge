-- Planned start date for proposals (Calendar + Job Ready integration).

alter table public.proposals
add column if not exists planned_start_date_text text;

alter table public.proposals
add column if not exists planned_start_date date;

comment on column public.proposals.planned_start_date_text is
  'Planned start wording from site notes or review — exact or vague (e.g. week commencing 18 September, middle of August).';

comment on column public.proposals.planned_start_date is
  'Exact planned start date when known (ISO date). Used by Calendar and Job Ready.';
