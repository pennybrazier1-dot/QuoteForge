"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { adminDeleteUser } from "@/app/admin/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSection } from "@/components/admin/admin-section";
import {
  canSelectUserForDelete,
  emailsMatchForConfirm,
  type AdminTestUserRow,
} from "@/lib/admin/test-users";

type Props = {
  users: AdminTestUserRow[];
  currentAdminId: string | null;
  loadError: string | null;
};

export function TestUsersPanel({
  users,
  currentAdminId,
  loadError,
}: Props) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  const confirmationMatches = selectedUser
    ? emailsMatchForConfirm(confirmEmail, selectedUser.email)
    : false;

  const canDelete = Boolean(
    selectedUser &&
      canSelectUserForDelete(selectedUser, currentAdminId) &&
      confirmationMatches &&
      !isPending
  );

  function handleSelect(user: AdminTestUserRow) {
    if (!canSelectUserForDelete(user, currentAdminId)) {
      return;
    }
    setSelectedUserId(user.id);
    setConfirmEmail("");
    setError(null);
    setSuccess(null);
  }

  function handleDelete() {
    if (!selectedUser || !canDelete) {
      return;
    }

    const confirmed = window.confirm(
      `Permanently delete ${selectedUser.email} and their workspace data?\n\nThis cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await adminDeleteUser({
        userId: selectedUser.id,
        confirmEmail: confirmEmail.trim(),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(
        `Deleted ${result.email}. Workspaces removed: ${result.deletedWorkspaces}. (Storage files are not removed by this helper — use the Storage API separately if needed.)`
      );
      setSelectedUserId("");
      setConfirmEmail("");
      router.refresh();
    });
  }

  return (
    <div className="qf-admin-page">
      <AdminPageHeader
        title="Test user deletion"
        description="Development tool: permanently delete a test auth user and their owned workspace via admin_delete_user."
      />

      <div className="qf-admin-inline-notice" role="note">
        This deletes the auth account and that user’s owned workspace tree
        (customers, proposals, enquiries, site visits). Storage photo files are
        not deleted here — hosted Supabase blocks SQL deletes on storage tables;
        clean those up with the Storage API separately if needed. Protected
        platform-admin emails cannot be deleted here.
      </div>

      {loadError ? (
        <p className="qf-admin-feedback qf-admin-feedback-error" role="alert">
          {loadError}
        </p>
      ) : null}

      {error ? (
        <p className="qf-admin-feedback qf-admin-feedback-error" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="qf-admin-feedback qf-admin-feedback-success" role="status">
          {success}
        </p>
      ) : null}

      <AdminSection
        title="Auth users"
        description="Select a user, type their email to confirm, then delete."
      >
        {users.length === 0 && !loadError ? (
          <p className="qf-admin-empty">No auth users with email addresses found.</p>
        ) : (
          <div className="qf-admin-table-wrap">
            <table className="qf-admin-table">
              <thead>
                <tr>
                  <th scope="col">Select</th>
                  <th scope="col">Email</th>
                  <th scope="col">Business</th>
                  <th scope="col">Workspace</th>
                  <th scope="col">Created</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const selectable = canSelectUserForDelete(
                    user,
                    currentAdminId
                  );
                  const selected = user.id === selectedUserId;

                  return (
                    <tr
                      key={user.id}
                      className={
                        selected ? "qf-admin-table-row-selected" : undefined
                      }
                    >
                      <td>
                        <input
                          type="radio"
                          name="test-user"
                          value={user.id}
                          checked={selected}
                          disabled={!selectable || isPending}
                          onChange={() => handleSelect(user)}
                          aria-label={`Select ${user.email}`}
                        />
                      </td>
                      <td className="qf-admin-table-strong">{user.email}</td>
                      <td>{user.businessName ?? "—"}</td>
                      <td>
                        {user.hasWorkspace ? (
                          <span className="qf-admin-pill qf-admin-pill-yes">
                            Yes
                          </span>
                        ) : (
                          <span className="qf-admin-pill qf-admin-pill-no">
                            No
                          </span>
                        )}
                      </td>
                      <td>
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleString()
                          : "—"}
                      </td>
                      <td>
                        {!selectable
                          ? user.isProtectedAdmin
                            ? "Protected admin"
                            : "Signed-in account"
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      <AdminSection
        title="Confirm deletion"
        description="Type the selected user’s email exactly to enable delete."
      >
        <div className="qf-admin-delete-form">
          <div className="qf-admin-delete-field">
            <span className="qf-admin-field-label">Selected user</span>
            <p className="qf-admin-delete-selected">
              {selectedUser
                ? `${selectedUser.email} (${selectedUser.id})`
                : "None selected"}
            </p>
          </div>

          <label className="qf-admin-delete-field" htmlFor="confirm-email">
            <span className="qf-admin-field-label">
              Type email to confirm
            </span>
            <input
              id="confirm-email"
              type="email"
              autoComplete="off"
              spellCheck={false}
              className="qf-admin-delete-input"
              value={confirmEmail}
              disabled={!selectedUser || isPending}
              placeholder={selectedUser?.email ?? "Select a user first"}
              onChange={(event) => {
                setConfirmEmail(event.target.value);
                setError(null);
                setSuccess(null);
              }}
            />
          </label>

          <button
            type="button"
            className="qf-btn-danger"
            disabled={!canDelete}
            onClick={handleDelete}
          >
            {isPending ? "Deleting…" : "Delete user permanently"}
          </button>
        </div>
      </AdminSection>
    </div>
  );
}
