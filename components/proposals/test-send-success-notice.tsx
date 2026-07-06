"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TestSendSuccessNoticeProps = {
  proposalId: string;
};

export function TestSendSuccessNotice({ proposalId }: TestSendSuccessNoticeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const testSentFromUrl = searchParams.get("testSent") === "1";
  const [visible, setVisible] = useState(false);
  const [handledTestSentUrl, setHandledTestSentUrl] = useState(false);

  if (testSentFromUrl && !handledTestSentUrl) {
    setHandledTestSentUrl(true);
    setVisible(true);
  }

  useEffect(() => {
    if (testSentFromUrl) {
      router.replace(`/proposals/${proposalId}`, { scroll: false });
    }
  }, [testSentFromUrl, proposalId, router]);

  if (!visible) {
    return null;
  }

  return (
    <div className="qf-workspace-notice qf-workspace-notice-success" role="status">
      <div>
        <p className="qf-workspace-notice-title">
          Test send complete — no email was sent.
        </p>
        <p className="qf-workspace-notice-body">
          Status updated to Waiting for Customer.
        </p>
      </div>
      <button
        type="button"
        className="qf-workspace-notice-dismiss"
        onClick={() => setVisible(false)}
      >
        Dismiss
      </button>
    </div>
  );
}
