"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  archiveCustomer,
  permanentlyDeleteCustomer,
  requestCustomerDeletion,
  restoreCustomer,
  type CustomerLifecycleActionState,
} from "@/app/customers/actions";
import { AuthError } from "@/components/auth/auth-shell";
import {
  CUSTOMER_PERMANENT_DELETE_CONFIRMATION,
  customerDeleteConfirmation,
  formatDeletionScheduledFor,
  type CustomerDetailActions,
} from "@/lib/customers/lifecycle";

const initialState: CustomerLifecycleActionState = {};

function ActionButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function LifecycleForm({
  customerId,
  action,
  children,
}: {
  customerId: string;
  action: (
    prev: CustomerLifecycleActionState,
    formData: FormData
  ) => Promise<CustomerLifecycleActionState>;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="qf-customer-lifecycle-form">
      <input type="hidden" name="customerId" value={customerId} />
      {state.error ? <AuthError message={state.error} /> : null}
      {children}
    </form>
  );
}

export function CustomerLifecycleActions({
  customerId,
  customerName,
  deletionScheduledFor,
  actions,
}: {
  customerId: string;
  customerName?: string | null;
  deletionScheduledFor?: string | null;
  actions: CustomerDetailActions;
}) {
  const [confirming, setConfirming] = useState<"delete" | "permanent" | null>(
    null
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const deletionDate = formatDeletionScheduledFor(deletionScheduledFor);

  return (
    <div className="qf-customer-lifecycle">
      {actions.state === "archived" ? (
        <p className="qf-customer-lifecycle-banner">
          This customer is archived. Jobs, proposals, and history stay available.
        </p>
      ) : null}

      {actions.state === "scheduled_for_deletion" ? (
        <p className="qf-customer-lifecycle-banner qf-customer-lifecycle-banner-warning">
          Scheduled for permanent deletion
          {deletionDate ? ` on ${deletionDate}` : ""}. You can restore them
          before then.
        </p>
      ) : null}

      <div className="qf-customer-lifecycle-toolbar">
        {actions.showBookVisit ? (
          <Link
            href={`/visits/new?customerId=${encodeURIComponent(customerId)}`}
            className="qf-btn-primary"
          >
            Book visit
          </Link>
        ) : null}

        {actions.showOverflowMenu ? (
          <div className="qf-customer-more">
            <button
              type="button"
              className="qf-customer-more-trigger"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              More
            </button>
            {menuOpen ? (
              <div className="qf-customer-more-menu" role="menu">
                {actions.showEdit ? (
                  <Link
                    href={`/customers/${customerId}/edit`}
                    className="qf-customer-more-item"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    Edit customer
                  </Link>
                ) : null}
                {actions.showArchive ? (
                  <LifecycleForm customerId={customerId} action={archiveCustomer}>
                    <ActionButton
                      label="Archive customer"
                      pendingLabel="Archiving…"
                      className="qf-customer-more-item"
                    />
                  </LifecycleForm>
                ) : null}
                {actions.showDelete ? (
                  <button
                    type="button"
                    className="qf-customer-more-item"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirming("delete");
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {actions.showRestore ? (
          <LifecycleForm customerId={customerId} action={restoreCustomer}>
            <ActionButton
              label="Restore"
              pendingLabel="Restoring…"
              className="qf-btn-primary"
            />
          </LifecycleForm>
        ) : null}

        {actions.showDelete && confirming === "delete" ? (
          <div className="qf-customer-confirm">
            <p>{customerDeleteConfirmation(customerName)}</p>
            <div className="qf-customer-confirm-actions">
              <LifecycleForm
                customerId={customerId}
                action={requestCustomerDeletion}
              >
                <ActionButton
                  label="Confirm delete"
                  pendingLabel="Scheduling…"
                  className="qf-btn-danger"
                />
              </LifecycleForm>
              <button
                type="button"
                className="qf-btn-secondary"
                onClick={() => setConfirming(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {actions.showDelete && !actions.showOverflowMenu && confirming !== "delete" ? (
          <button
            type="button"
            className="qf-btn-danger"
            onClick={() => setConfirming("delete")}
          >
            Delete
          </button>
        ) : null}

        {actions.showPermanentDelete ? (
          confirming === "permanent" ? (
            <div className="qf-customer-confirm">
              <p>{CUSTOMER_PERMANENT_DELETE_CONFIRMATION}</p>
              <div className="qf-customer-confirm-actions">
                <LifecycleForm
                  customerId={customerId}
                  action={permanentlyDeleteCustomer}
                >
                  <ActionButton
                    label="Delete permanently now"
                    pendingLabel="Deleting…"
                    className="qf-btn-danger"
                  />
                </LifecycleForm>
                <button
                  type="button"
                  className="qf-btn-secondary"
                  onClick={() => setConfirming(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="qf-btn-secondary"
              onClick={() => setConfirming("permanent")}
            >
              Delete permanently now
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
