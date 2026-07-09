import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSection } from "@/components/admin/admin-section";
import type { PlatformUser } from "@/lib/admin/types";
import { USER_ROLE_LABELS } from "@/lib/admin/types";

export function UsersPanel({ users }: { users: PlatformUser[] }) {
  return (
    <div className="qf-admin-page">
      <AdminPageHeader
        title="Users"
        description="People with access to tradesperson workspaces — placeholder list."
      />

      <AdminSection title="All users">
        <div className="qf-admin-table-wrap">
          <table className="qf-admin-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Business</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="qf-admin-table-strong">{user.name}</td>
                  <td>{user.email}</td>
                  <td>{USER_ROLE_LABELS[user.role]}</td>
                  <td>{user.businessName}</td>
                  <td className="qf-admin-capitalize">{user.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </div>
  );
}
