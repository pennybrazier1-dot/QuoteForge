"use client";

import { useEffect } from "react";
import {
  logWorkspaceScrollDiagnostics,
  syncWorkspaceScrollEndHeight,
} from "@/lib/dev/workspace-scroll-debug";

/**
 * Physical spacer at the end of workspace main — extends document scroll height
 * so iOS Safari can rest with the last item above the fixed bottom nav.
 */
export function WorkspaceScrollEnd() {
  return (
    <div
      className="qf-workspace-scroll-end"
      aria-hidden="true"
      data-qf-scroll-end="true"
    />
  );
}

/** Measures bottom nav height and sets --qf-workspace-scroll-end-height. */
export function WorkspaceScrollSync() {
  useEffect(() => {
    const sync = () => {
      syncWorkspaceScrollEndHeight();
    };

    sync();

    const timers = [
      window.setTimeout(sync, 50),
      window.setTimeout(sync, 250),
      window.setTimeout(sync, 1000),
    ];

    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, []);

  return null;
}

/** Temporary debug — logs scroll container + clearance (dev / NEXT_PUBLIC_QF_SCROLL_DEBUG=1). */
export function WorkspaceScrollDebug({ context }: { context: string }) {
  useEffect(() => {
    const log = () => {
      logWorkspaceScrollDiagnostics(context);
    };

    log();

    const timer = window.setTimeout(log, 400);
    window.addEventListener("scroll", log, { passive: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", log);
    };
  }, [context]);

  return null;
}
