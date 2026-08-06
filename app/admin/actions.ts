"use server";

import {
  isUuid,
  mapAdminDeleteUserError,
  parseAdminDeleteUserRpcPayload,
  type AdminDeleteUserResult,
} from "@/lib/admin/delete-user";
import {
  isPlatformAdmin,
  resolveAuthEmail,
} from "@/lib/admin/platform-admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminDeleteUserInput = {
  userId: string;
  confirmEmail: string;
};

/**
 * Platform-admin helper: deletes owned workspace tree, then the auth user.
 * Keeps workspaces.owner_id ON DELETE RESTRICT; never relies on silent cascade
 * from auth.users.
 */
export async function adminDeleteUser(
  input: AdminDeleteUserInput
): Promise<AdminDeleteUserResult> {
  const userId = input.userId.trim();
  const confirmEmail = input.confirmEmail.trim();

  if (!userId) {
    return {
      ok: false,
      code: "USER_ID_REQUIRED",
      error: "A user id is required.",
    };
  }

  if (!isUuid(userId)) {
    return {
      ok: false,
      code: "INVALID_USER_ID",
      error: "User id must be a valid UUID.",
    };
  }

  if (!confirmEmail) {
    return {
      ok: false,
      code: "CONFIRM_EMAIL_REQUIRED",
      error: "confirmEmail must match the user email exactly.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user: adminUser },
  } = await supabase.auth.getUser();

  if (!adminUser) {
    return {
      ok: false,
      code: "RPC_ERROR",
      error: "You must be signed in as a platform admin.",
    };
  }

  const adminEmail = resolveAuthEmail(adminUser);
  if (!isPlatformAdmin(adminEmail)) {
    return {
      ok: false,
      code: "RPC_ERROR",
      error: "Only platform admins can delete users.",
    };
  }

  if (adminUser.id === userId) {
    return {
      ok: false,
      code: "SELF_DELETE_BLOCKED",
      error: "Refusing to delete the currently signed-in admin account.",
    };
  }

  let adminClient;
  try {
    adminClient = createServiceRoleClient();
  } catch (error) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      error:
        error instanceof Error
          ? error.message
          : "Service role client is not configured.",
    };
  }

  const { data, error } = await adminClient.rpc("admin_delete_user", {
    target_user_id: userId,
    confirm_email: confirmEmail,
  });

  if (error) {
    return mapAdminDeleteUserError(error.message);
  }

  return parseAdminDeleteUserRpcPayload(data);
}
