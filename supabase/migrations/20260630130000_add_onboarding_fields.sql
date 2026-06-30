-- Version 1 onboarding fields:
-- - workspaces.trade_type
-- - profiles.heard_about

alter table public.workspaces
add column trade_type text;

comment on column public.workspaces.trade_type is
  'Trade selected during onboarding, e.g. Plumber, Electrician, Other. See docs/PROJECT.md for allowed values.';

alter table public.profiles
add column heard_about text;

comment on column public.profiles.heard_about is
  'How the user found QuoteForge, e.g. Google, Recommendation, Other. See docs/PROJECT.md for allowed values.';
