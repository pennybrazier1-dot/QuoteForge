-- =============================================================================
-- ROLLBACK — Phase 30 temporary testing-mode auth user deletion workflow
-- =============================================================================
-- Run this manually before production launch (do NOT keep applying it via
-- normal forward migrations). Removes the temporary trigger and function.
--
-- Leaves workspaces.owner_id ON DELETE RESTRICT unchanged.
-- After this rollback, Dashboard "Delete user" will again fail for owners
-- until you use public.admin_delete_user(...) or delete the workspace first.
-- =============================================================================

drop trigger if exists testing_auth_users_before_delete_cleanup_workspaces
  on auth.users;

drop function if exists public.testing_delete_owned_workspaces_before_auth_user_delete();
