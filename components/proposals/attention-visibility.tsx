"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  RESOLUTION_DISMISS_EVENT,
  RESOLUTION_RESTORE_EVENT,
} from "@/lib/proposals/change-request/optimistic-resolution";

const AttentionDismissedContext = createContext(false);

export function AttentionVisibilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const hide = () => setDismissed(true);
    const show = () => setDismissed(false);
    window.addEventListener(RESOLUTION_DISMISS_EVENT, hide);
    window.addEventListener(RESOLUTION_RESTORE_EVENT, show);
    return () => {
      window.removeEventListener(RESOLUTION_DISMISS_EVENT, hide);
      window.removeEventListener(RESOLUTION_RESTORE_EVENT, show);
    };
  }, []);

  return (
    <AttentionDismissedContext.Provider value={dismissed}>
      {children}
    </AttentionDismissedContext.Provider>
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
