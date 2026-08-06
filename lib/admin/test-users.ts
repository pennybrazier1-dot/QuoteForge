import { isPlatformAdminAllowlisted } from "@/lib/admin/platform-admin";

export type AdminTestUserRow = {
  id: string;
  email: string;
  createdAt: string | null;
  businessName: string | null;
  hasWorkspace: boolean;
  /** True when email is on PLATFORM_ADMIN_EMAILS — delete disabled in UI. */
  isProtectedAdmin: boolean;
};

export type AuthUserListItem = {
  id: string;
  email?: string | null;
  created_at?: string | null;
};

export type WorkspaceOwnerRow = {
  id: string;
  owner_id: string;
  business_name: string | null;
};

/**
 * Build the admin test-user table from auth users + owned workspaces.
 * Skips users without an email (cannot confirm-delete safely).
 */
export function buildAdminTestUserRows(
  authUsers: AuthUserListItem[],
  workspaces: WorkspaceOwnerRow[]
): AdminTestUserRow[] {
  const workspaceByOwner = new Map<string, WorkspaceOwnerRow>();
  for (const workspace of workspaces) {
    workspaceByOwner.set(workspace.owner_id, workspace);
  }

  const rows: AdminTestUserRow[] = [];

  for (const user of authUsers) {
    const email = user.email?.trim();
    if (!email) {
      continue;
    }

    const workspace = workspaceByOwner.get(user.id);

    rows.push({
      id: user.id,
      email,
      createdAt: user.created_at ?? null,
      businessName: workspace?.business_name?.trim() || null,
      hasWorkspace: Boolean(workspace),
      isProtectedAdmin: isPlatformAdminAllowlisted(email),
    });
  }

  rows.sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });

  return rows;
}

export function emailsMatchForConfirm(
  typed: string,
  expected: string
): boolean {
  return typed.trim().toLowerCase() === expected.trim().toLowerCase();
}

export function canSelectUserForDelete(
  user: AdminTestUserRow,
  currentAdminId: string | null
): boolean {
  if (user.isProtectedAdmin) {
    return false;
  }
  if (currentAdminId && user.id === currentAdminId) {
    return false;
  }
  return true;
}
