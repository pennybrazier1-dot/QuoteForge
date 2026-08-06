import { TestUsersPanel } from "@/components/admin/test-users-panel";
import { loadAdminTestUsers } from "@/lib/admin/load-test-users";

export default async function AdminTestUsersPage() {
  const { users, currentAdminId, error } = await loadAdminTestUsers();

  return (
    <TestUsersPanel
      users={users}
      currentAdminId={currentAdminId}
      loadError={error}
    />
  );
}
