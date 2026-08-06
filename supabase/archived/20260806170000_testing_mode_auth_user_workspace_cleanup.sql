-- =============================================================================
-- PHASE 30 — TEMPORARY TESTING-STAGE AUTH USER DELETION WORKFLOW
-- =============================================================================
-- Purpose:
--   While Reanvil is still in testing, Supabase Dashboard
--   Authentication → Users → Delete user must succeed even when the user
--   owns a workspace.
--
-- Why this exists:
--   public.workspaces.owner_id references auth.users(id) ON DELETE RESTRICT.
--   That FK is intentionally kept. A BEFORE DELETE trigger on auth.users
--   removes only that user's owned workspace(s) first so the Restrict check
--   no longer blocks the auth delete.
--
-- Safety / scope:
--   - Deletes ONLY public.workspaces WHERE owner_id = OLD.id
--   - Does not touch other users' workspaces
--   - Does not change the ON DELETE RESTRICT foreign key
--   - Does not weaken RLS policies (uses SECURITY DEFINER only for this
--     privileged cleanup path during auth.users deletion)
--
-- IMPORTANT:
--   REMOVE THIS BEFORE PRODUCTION LAUNCH.
--   Rollback SQL:
--     supabase/rollbacks/20260806170000_testing_mode_auth_user_workspace_cleanup.rollback.sql
-- =============================================================================

create or replace function public.testing_delete_owned_workspaces_before_auth_user_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- TEMPORARY TESTING ONLY — delete workspaces founded by this auth user.
  -- Existing workspace ON DELETE CASCADE rules then clear that user's test data.
  delete from public.workspaces
  where owner_id = old.id;

  return old;
end;
$$;

comment on function public.testing_delete_owned_workspaces_before_auth_user_delete() is
  'TEMPORARY TESTING ONLY. BEFORE DELETE on auth.users: deletes workspaces owned by the user so dashboard auth deletion can proceed despite workspaces.owner_id ON DELETE RESTRICT. Remove before production launch.';

drop trigger if exists testing_auth_users_before_delete_cleanup_workspaces
  on auth.users;

create trigger testing_auth_users_before_delete_cleanup_workspaces
before delete on auth.users
for each row
execute function public.testing_delete_owned_workspaces_before_auth_user_delete();

comment on trigger testing_auth_users_before_delete_cleanup_workspaces on auth.users is
  'TEMPORARY TESTING ONLY. Cleans owned workspaces before auth.users delete. Remove before production launch.';
