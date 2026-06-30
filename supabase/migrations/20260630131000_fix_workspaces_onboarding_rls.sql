-- Fix onboarding RLS for workspaces.
--
-- Problem:
--   During onboarding the app inserts a workspace and reads it back
--   (INSERT ... RETURNING via .select()). The SELECT policy used
--   current_workspace_id(), which is null before the profile exists,
--   so the new row could not be returned and the insert was rejected.
--
-- Fix:
--   - Re-assert the INSERT policy: a user may only create a workspace
--     they own (owner_id = auth.uid()).
--   - Allow an owner to read their own workspace by owner_id as well as
--     by current_workspace_id(), so the founding workspace is visible
--     during onboarding before a profile exists.
--
-- This does not disable RLS, does not use the service role, and does not
-- change customer or proposal policies.

drop policy if exists "Users can create their own workspace" on public.workspaces;

create policy "Users can create their own workspace"
on public.workspaces
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Users can view their workspace" on public.workspaces;

create policy "Users can view their workspace"
on public.workspaces
for select
to authenticated
using (
  owner_id = auth.uid()
  or id = public.current_workspace_id()
);
