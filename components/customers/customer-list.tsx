"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import {
  archiveCustomer,
  permanentlyDeleteCustomer,
  requestCustomerDeletion,
  restoreCustomer,
  type CustomerLifecycleActionState,
} from "@/app/customers/actions";
import {
  CUSTOMER_LIST_SWIPE_MEDIA,
  customerDeleteConfirmation,
  customerListDesktopActions,
  customerListRowDisplay,
  customerListSwipeActions,
  formatDeletionScheduledFor,
  type CustomerListActionKey,
  type CustomerListView,
} from "@/lib/customers/lifecycle";
import {
  customerDetailHref,
  customerListOuterTitle,
} from "@/lib/customers/list-layout";

export type CustomerListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  created_at: string;
  activated_at?: string | null;
  archived_at?: string | null;
  deletion_requested_at?: string | null;
  deletion_scheduled_for?: string | null;
};

const VIEW_COPY: Record<
  CustomerListView,
  { title: string; empty: string; countLabel: string }
> = {
  active: {
    title: "Active customers",
    empty:
      "No active customers yet. People appear here when a proposal is accepted and a job is booked, or when you add someone yourself.",
    countLabel: "active",
  },
  archived: {
    title: "Archived customers",
    empty: "No archived customers.",
    countLabel: "archived",
  },
  scheduled: {
    title: "Scheduled for deletion",
    empty: "No customers are waiting to be deleted.",
    countLabel: "scheduled",
  },
};

const ACTION_WIDTH = 92;
const SWIPE_OPEN_THRESHOLD = 48;
const initialActionState: CustomerLifecycleActionState = {};

let closeOpenSwipe: (() => void) | null = null;

const ACTION_LABEL: Record<CustomerListActionKey, string> = {
  archive: "Archive",
  delete: "Delete",
  restore: "Restore",
  permanent_delete: "Delete now",
};

function useIsMobileCustomers() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(CUSTOMER_LIST_SWIPE_MEDIA);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function ActionSubmit({
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

function CustomerActionForm({
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
  const [state, formAction] = useActionState(action, initialActionState);
  return (
    <form action={formAction}>
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="returnTo" value="list" />
      {state.error ? (
        <p className="qf-customer-list-error">{state.error}</p>
      ) : null}
      {children}
    </form>
  );
}

function actionServerFn(key: CustomerListActionKey) {
  switch (key) {
    case "archive":
      return archiveCustomer;
    case "restore":
      return restoreCustomer;
    case "delete":
      return requestCustomerDeletion;
    case "permanent_delete":
      return permanentlyDeleteCustomer;
  }
}

function ConfirmPanel({
  customer,
  actionKey,
  onCancel,
}: {
  customer: CustomerListItem;
  actionKey: "delete" | "permanent_delete";
  onCancel: () => void;
}) {
  const isPermanent = actionKey === "permanent_delete";
  return (
    <div className="qf-customer-list-confirm" role="dialog" aria-modal="true">
      <p>
        {isPermanent
          ? `Permanently delete ${customer.name} now? Linked jobs, proposals, and history are kept when they are needed for your records.`
          : customerDeleteConfirmation(customer.name)}
      </p>
      <div className="qf-customer-confirm-actions">
        <CustomerActionForm
          customerId={customer.id}
          action={actionServerFn(actionKey)}
        >
          <ActionSubmit
            label={isPermanent ? "Delete permanently now" : "Confirm delete"}
            pendingLabel={isPermanent ? "Deleting…" : "Scheduling…"}
            className="qf-btn-danger"
          />
        </CustomerActionForm>
        <button type="button" className="qf-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function CustomerRowChevron() {
  return (
    <svg
      className="qf-customer-row-chevron"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function CustomerRowContent({
  customer,
  view,
  isMobile,
}: {
  customer: CustomerListItem;
  view: CustomerListView;
  isMobile: boolean;
}) {
  const display = customerListRowDisplay(view, { isMobile });
  const deletionDate = formatDeletionScheduledFor(customer.deletion_scheduled_for);

  return (
    <div className="qf-customer-row-main">
      <div className="qf-customer-row-copy">
        <p className="qf-customer-row-name">{customer.name}</p>
        {display.showEmail && customer.email ? (
          <p className="qf-customer-row-meta">{customer.email}</p>
        ) : null}
        {display.showDeletionDate && deletionDate ? (
          <p className="qf-customer-row-meta">Deletion scheduled {deletionDate}</p>
        ) : null}
      </div>
      {display.showChevron ? <CustomerRowChevron /> : null}
    </div>
  );
}

function DesktopOverflow({
  customer,
  view,
  onConfirm,
}: {
  customer: CustomerListItem;
  view: CustomerListView;
  onConfirm: (key: "delete" | "permanent_delete") => void;
}) {
  const [open, setOpen] = useState(false);
  const actions = customerListDesktopActions(view);

  return (
    <div className="qf-customer-row-more">
      <button
        type="button"
        className="qf-customer-more-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`More actions for ${customer.name}`}
        onClick={() => setOpen((value) => !value)}
      >
        More
      </button>
      {open ? (
        <div className="qf-customer-more-menu" role="menu">
          {actions.map((key) => {
            if (key === "delete" || key === "permanent_delete") {
              return (
                <button
                  key={key}
                  type="button"
                  className="qf-customer-more-item"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    onConfirm(key);
                  }}
                >
                  {ACTION_LABEL[key]}
                </button>
              );
            }
            return (
              <CustomerActionForm
                key={key}
                customerId={customer.id}
                action={actionServerFn(key)}
              >
                <ActionSubmit
                  label={ACTION_LABEL[key]}
                  pendingLabel="Saving…"
                  className="qf-customer-more-item"
                />
              </CustomerActionForm>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SwipeableCustomerRow({
  customer,
  view,
}: {
  customer: CustomerListItem;
  view: CustomerListView;
}) {
  const isMobile = useIsMobileCustomers();
  const actions = customerListSwipeActions(view);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [confirming, setConfirming] = useState<"delete" | "permanent_delete" | null>(
    null
  );
  const dragStartX = useRef(0);
  const dragStartOffset = useRef(0);
  const maxOffset = ACTION_WIDTH * actions.length;

  const closeSwipe = useCallback(() => {
    setOffset(0);
    closeOpenSwipe = null;
  }, []);

  useEffect(() => {
    if (offset >= 0) {
      return;
    }
    if (closeOpenSwipe && closeOpenSwipe !== closeSwipe) {
      closeOpenSwipe();
    }
    closeOpenSwipe = closeSwipe;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(`[data-customer-row="${customer.id}"]`)) {
        return;
      }
      closeSwipe();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [closeSwipe, customer.id, offset]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    setIsDragging(true);
    dragStartX.current = event.clientX;
    dragStartOffset.current = offset;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDragging) {
      return;
    }
    const delta = event.clientX - dragStartX.current;
    const nextOffset = Math.max(
      -maxOffset,
      Math.min(0, dragStartOffset.current + delta)
    );
    setOffset(nextOffset);
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDragging) {
      return;
    }
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setOffset((current) =>
      Math.abs(current) > SWIPE_OPEN_THRESHOLD ? -maxOffset : 0
    );
  }

  if (!isMobile) {
    return (
      <li className="qf-customer-row-desktop" data-customer-row={customer.id}>
        <Link href={customerDetailHref(customer.id)} className="qf-customer-row-link">
          <CustomerRowContent customer={customer} view={view} isMobile={false} />
        </Link>
        <DesktopOverflow
          customer={customer}
          view={view}
          onConfirm={setConfirming}
        />
        {confirming ? (
          <ConfirmPanel
            customer={customer}
            actionKey={confirming}
            onCancel={() => setConfirming(null)}
          />
        ) : null}
      </li>
    );
  }

  return (
    <li className="qf-customer-row-swipe-wrap" data-customer-row={customer.id}>
      <div className="qf-customer-swipe">
        <div
          className="qf-customer-swipe-actions"
          style={{ width: `${maxOffset}px` }}
          aria-hidden={offset === 0}
        >
          {actions.map((key) => {
            const className =
              key === "delete" || key === "permanent_delete"
                ? "qf-customer-swipe-action is-delete"
                : "qf-customer-swipe-action is-archive";
            if (key === "delete" || key === "permanent_delete") {
              return (
                <button
                  key={key}
                  type="button"
                  className={className}
                  style={{ width: `${ACTION_WIDTH}px` }}
                  onClick={() => {
                    closeSwipe();
                    setConfirming(key);
                  }}
                >
                  {ACTION_LABEL[key]}
                </button>
              );
            }
            return (
              <CustomerActionForm
                key={key}
                customerId={customer.id}
                action={actionServerFn(key)}
              >
                <ActionSubmit
                  label={ACTION_LABEL[key]}
                  pendingLabel="…"
                  className={className}
                />
              </CustomerActionForm>
            );
          })}
        </div>
        <div
          className="qf-customer-swipe-panel"
          style={{
            transform: `translateX(${offset}px)`,
            transition: isDragging ? "none" : "transform 0.2s ease",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          <Link
            href={customerDetailHref(customer.id)}
            className="qf-customer-row-link"
            onClick={(event) => {
              if (Math.abs(offset) > 8) {
                event.preventDefault();
                closeSwipe();
              }
            }}
          >
            <CustomerRowContent customer={customer} view={view} isMobile />
          </Link>
        </div>
      </div>
      {confirming ? (
        <ConfirmPanel
          customer={customer}
          actionKey={confirming}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </li>
  );
}

export function CustomerList({
  customers,
  view,
}: {
  customers: CustomerListItem[];
  view: CustomerListView;
}) {
  const isMobile = useIsMobileCustomers();
  const copy = VIEW_COPY[view];
  const outerTitle = customerListOuterTitle(view, isMobile);

  if (customers.length === 0) {
    return (
      <div className="qf-customer-list-empty">
        <p className="text-sm text-muted">{copy.empty}</p>
      </div>
    );
  }

  return (
    <div className="qf-customer-list-wrap">
      {outerTitle ? (
        <div className="qf-customer-list-heading">
          <h2 className="text-lg font-semibold">{outerTitle}</h2>
          <span className="text-xs text-muted">
            {customers.length} {copy.countLabel}
          </span>
        </div>
      ) : null}

      <ul className="qf-customer-list">
        {customers.map((customer) => (
          <SwipeableCustomerRow
            key={customer.id}
            customer={customer}
            view={view}
          />
        ))}
      </ul>
    </div>
  );
}
