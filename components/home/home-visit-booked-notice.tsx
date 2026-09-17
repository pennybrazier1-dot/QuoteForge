"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TRADER_HOME_PATH, VISIT_CREATED_NOTICE } from "@/lib/visits/new-visit";

export function HomeVisitBookedNotice() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return null;
  }

  return (
    <div className="qf-workspace-notice qf-workspace-notice-success" role="status">
      <p className="qf-workspace-notice-title">{VISIT_CREATED_NOTICE}</p>
      <button
        type="button"
        className="qf-workspace-notice-dismiss"
        onClick={() => {
          setVisible(false);
          router.replace(TRADER_HOME_PATH, { scroll: false });
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
