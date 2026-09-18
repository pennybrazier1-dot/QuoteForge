"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  JOB_COMPLETED_NOTICE,
  jobCompletedNoticeSupport,
} from "@/lib/jobs/complete-job";
import { TRADER_HOME_PATH } from "@/lib/visits/new-visit";

export function HomeJobCompletedNotice({
  customerName,
}: {
  customerName?: string | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const support = jobCompletedNoticeSupport(customerName);

  if (!visible) {
    return null;
  }

  return (
    <div className="qf-workspace-notice qf-workspace-notice-success" role="status">
      <div>
        <p className="qf-workspace-notice-title">{JOB_COMPLETED_NOTICE}</p>
        {support ? (
          <p className="qf-workspace-notice-body">{support}</p>
        ) : null}
      </div>
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
