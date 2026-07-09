import { UsersPanel } from "@/components/admin/users-panel";
import { PLACEHOLDER_USERS } from "@/lib/admin/placeholder-data";

export default function AdminUsersPage() {
  return <UsersPanel users={PLACEHOLDER_USERS} />;
}
