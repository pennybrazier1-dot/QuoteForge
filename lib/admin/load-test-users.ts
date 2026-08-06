import {
  buildAdminTestUserRows,
  type AdminTestUserRow,
} from "@/lib/admin/test-users";
import {
  isPlatformAdmin,
  resolveAuthEmail,
} from "@/lib/admin/platform-admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LoadAdminTestUsersResult = {
  users: AdminTestUserRow[];
  currentAdminId: string | null;
  error: string | null;
};

/**
 * Lists auth users for the admin test-deletion tool.
 * Requires a signed-in platform admin + SUPABASE_SERVICE_ROLE_KEY.
 */
export async function loadAdminTestUsers(): Promise<LoadAdminTestUsersResult> {
  const supabase = await createClient();
  const {
    data: { user: adminUser },
  } = await supabase.auth.getUser();

  if (!adminUser) {
    return {
      users: [],
      currentAdminId: null,
      error: "You must be signed in as a platform admin.",
    };
  }

  const adminEmail = resolveAuthEmail(adminUser);
  if (!isPlatformAdmin(adminEmail)) {
    return {
      users: [],
      currentAdminId: null,
      error: "Only platform admins can list users for deletion.",
    };
  }

  let adminClient;
  try {
    adminClient = createServiceRoleClient();
  } catch (error) {
    return {
      users: [],
      currentAdminId: adminUser.id,
      error:
        error instanceof Error
          ? error.message
          : "Service role client is not configured.",
    };
  }

  const { data: listData, error: listError } =
    await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

  if (listError) {
    return {
      users: [],
      currentAdminId: adminUser.id,
      error: listError.message || "Could not list auth users.",
    };
  }

  const authUsers = listData?.users ?? [];
  const ownerIds = authUsers.map((user) => user.id);

  let workspaces: {
    id: string;
    owner_id: string;
    business_name: string | null;
  }[] = [];

  if (ownerIds.length > 0) {
    const { data: workspaceRows, error: workspaceError } = await adminClient
      .from("workspaces")
      .select("id, owner_id, business_name")
      .in("owner_id", ownerIds);

    if (workspaceError) {
      return {
        users: [],
        currentAdminId: adminUser.id,
        error: workspaceError.message || "Could not load workspaces.",
      };
    }

    workspaces = workspaceRows ?? [];
  }

  return {
    users: buildAdminTestUserRows(authUsers, workspaces),
    currentAdminId: adminUser.id,
    error: null,
  };
}
