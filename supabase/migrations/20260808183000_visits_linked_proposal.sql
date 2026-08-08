-- Phase 50E.2: Link visits to created quotes.

alter table public.visits
  add column if not exists linked_proposal_id uuid
    references public.proposals(id) on delete set null;

create index if not exists visits_linked_proposal_id_idx
  on public.visits (linked_proposal_id);

comment on column public.visits.linked_proposal_id is
  'Proposal created from this visit, if any.';
