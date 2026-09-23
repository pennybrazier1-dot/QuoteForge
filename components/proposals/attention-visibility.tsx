"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  RESOLUTION_ACCEPTED_EVENT,
  RESOLUTION_DISMISS_EVENT,
  RESOLUTION_RESTORE_EVENT,
  type AcceptedRequestedSlotDetail,
} from "@/lib/proposals/change-request/optimistic-resolution";
import { JOB_BOOKED_STATUS_TITLE } from "@/lib/proposals/date-workflow";

const AttentionDismissedContext = createContext(false);
const AcceptedSlotContext = createContext<AcceptedRequestedSlotDetail | null>(
  null
);

export function AttentionVisibilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [acceptedSlot, setAcceptedSlot] =
    useState<AcceptedRequestedSlotDetail | null>(null);

  useEffect(() => {
    const hide = () => setDismissed(true);
    const show = () => {
      setDismissed(false);
      setAcceptedSlot(null);
    };
    const accept = (event: Event) => {
      const custom = event as CustomEvent<AcceptedRequestedSlotDetail>;
      if (custom.detail?.label) {
        setAcceptedSlot(custom.detail);
      }
    };
    window.addEventListener(RESOLUTION_DISMISS_EVENT, hide);
    window.addEventListener(RESOLUTION_RESTORE_EVENT, show);
    window.addEventListener(RESOLUTION_ACCEPTED_EVENT, accept);
    return () => {
      window.removeEventListener(RESOLUTION_DISMISS_EVENT, hide);
      window.removeEventListener(RESOLUTION_RESTORE_EVENT, show);
      window.removeEventListener(RESOLUTION_ACCEPTED_EVENT, accept);
    };
  }, []);

  return (
    <AttentionDismissedContext.Provider value={dismissed}>
      <AcceptedSlotContext.Provider value={acceptedSlot}>
        {children}
      </AcceptedSlotContext.Provider>
    </AttentionDismissedContext.Provider>
  );
}

/** Replaces the visible date immediately after Accept, without waiting to reopen. */
export function OptimisticOrServerDateBanner({
  isBookedJob,
  confirmedSlotLabel,
}: {
  isBookedJob: boolean;
  confirmedSlotLabel: string | null;
}) {
  const accepted = useContext(AcceptedSlotContext);
  const label = accepted?.label || confirmedSlotLabel;
  const booked = accepted?.booked ?? isBookedJob;
  if (!label || (!booked && !accepted)) {
    return null;
  }
  if (!accepted && !isBookedJob) {
    return null;
  }

  return (
    <section
      className="qf-date-state-banner qf-date-state-banner-booked"
      role="status"
    >
      <p className="qf-date-state-title">
        {booked ? JOB_BOOKED_STATUS_TITLE : "Date confirmed ✓"}
      </p>
      <p className="qf-date-state-copy">{label}</p>
    </section>
  );
}

/** Renders only while an unresolved attention action is still visible. */
export function AttentionOnly({ children }: { children: ReactNode }) {
  const dismissed = useContext(AttentionDismissedContext);
  if (dismissed) {
    return null;
  }
  return children;
}

/** Renders the normal job actions once attention is gone or dismissed. */
export function AfterAttentionIdle({
  hasAttention,
  children,
}: {
  hasAttention: boolean;
  children: ReactNode;
}) {
  const dismissed = useContext(AttentionDismissedContext);
  if (hasAttention && !dismissed) {
    return null;
  }
  return children;
}
