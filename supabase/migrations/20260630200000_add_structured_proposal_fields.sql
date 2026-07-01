-- Structured proposal fields for accepted AI-generated content.

alter table public.proposals
add column if not exists job_summary text;

alter table public.proposals
add column if not exists estimated_duration text;

alter table public.proposals
add column if not exists labour_description text;

alter table public.proposals
add column if not exists things_to_confirm_items jsonb not null default '[]'::jsonb;

alter table public.proposals
add column if not exists ai_optional_extras jsonb not null default '[]'::jsonb;

comment on column public.proposals.job_summary is
  'AI-generated job summary after the tradesperson accepts a draft.';

comment on column public.proposals.estimated_duration is
  'Estimated duration for the proposal, from the form or accepted AI draft.';

comment on column public.proposals.labour_description is
  'AI-generated labour section after the tradesperson accepts a draft.';

comment on column public.proposals.things_to_confirm_items is
  'AI-generated things to confirm, stored as a JSON array of strings.';

comment on column public.proposals.ai_optional_extras is
  'AI-generated optional extras, separate from the tradesperson rough optional extras field.';
