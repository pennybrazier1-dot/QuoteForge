-- Phase 29: Admin-only helper to delete a test/dev user safely.
-- Intentionally keeps public.workspaces.owner_id ON DELETE RESTRICT.
-- Callers must delete workspace data first via this function (explicit),
-- then this function deletes auth.users.

create or replace function public.admin_delete_user(
  target_user_id uuid,
  confirm_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  found_email text;
  workspace_ids uuid[];
  deleted_workspace_count integer := 0;
  deleted_storage_count integer := 0;
  deleted_auth_count integer := 0;
begin
  if target_user_id is null then
    raise exception 'USER_ID_REQUIRED: A user id is required.';
  end if;

  if confirm_email is null or btrim(confirm_email) = '' then
    raise exception
      'CONFIRM_EMAIL_REQUIRED: confirm_email must match the user email exactly.';
  end if;

  select u.email::text
  into found_email
  from auth.users as u
  where u.id = target_user_id;

  if found_email is null then
    raise exception 'USER_NOT_FOUND: No auth user exists with id %.', target_user_id;
  end if;

  if lower(found_email) <> lower(btrim(confirm_email)) then
    raise exception
      'EMAIL_MISMATCH: confirm_email (%) does not match auth user email (%).',
      btrim(confirm_email),
      found_email;
  end if;

  select coalesce(array_agg(w.id), array[]::uuid[])
  into workspace_ids
  from public.workspaces as w
  where w.owner_id = target_user_id;

  if coalesce(cardinality(workspace_ids), 0) > 0 then
    -- Remove private site-visit photos before workspace rows cascade away.
    delete from storage.objects as object_row
    using unnest(workspace_ids) as workspace_id(id)
    where object_row.bucket_id = 'site-visit-photos'
      and (storage.foldername(object_row.name))[1] = workspace_id.id::text;

    get diagnostics deleted_storage_count = row_count;

    -- Cascades customers, proposals, enquiries, site visits, media metadata, profiles, etc.
    delete from public.workspaces as w
    where w.id = any (workspace_ids);

    get diagnostics deleted_workspace_count = row_count;
  end if;

  -- Safety net if a profile remained without a deleted workspace edge case.
  delete from public.profiles as p
  where p.id = target_user_id;

  delete from auth.users as u
  where u.id = target_user_id;

  get diagnostics deleted_auth_count = row_count;

  if deleted_auth_count <> 1 then
    raise exception
      'AUTH_DELETE_FAILED: Auth user % could not be deleted after workspace cleanup.',
      target_user_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'userId', target_user_id,
    'email', found_email,
    'deletedWorkspaces', deleted_workspace_count,
    'deletedStorageObjects', deleted_storage_count
  );
exception
  when foreign_key_violation then
    raise exception
      'FK_BLOCKED: Could not finish deleting user % because related rows still reference auth.users. %',
      target_user_id,
      sqlerrm;
end;
$$;

comment on function public.admin_delete_user(uuid, text) is
  'Admin/service-role helper: deletes owned workspace tree, then auth.users. Does not weaken workspaces.owner_id ON DELETE RESTRICT.';

revoke all on function public.admin_delete_user(uuid, text) from public;
revoke all on function public.admin_delete_user(uuid, text) from anon;
revoke all on function public.admin_delete_user(uuid, text) from authenticated;
grant execute on function public.admin_delete_user(uuid, text) to service_role;
