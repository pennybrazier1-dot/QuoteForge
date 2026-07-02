"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SendProposalDialog } from "@/components/proposals/send-proposal-dialog";
import type { SendProposalContext } from "@/lib/proposals/send-proposal-defaults";

type SendProposalProviderValue = {
  openSendDialog: () => void;
};

const SendProposalContext = createContext<SendProposalProviderValue | null>(
  null
);

export function useSendProposalDialog(): SendProposalProviderValue {
  const context = useContext(SendProposalContext);

  if (!context) {
    throw new Error(
      "useSendProposalDialog must be used within SendProposalProvider"
    );
  }

  return context;
}

function ProposalSentNotice({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  return (
    <div className="qf-workspace-notice qf-workspace-notice-success" role="status">
      <div>
        <p className="qf-workspace-notice-title">Proposal sent successfully</p>
        <p className="qf-workspace-notice-body">
          Your proposal has been emailed to the customer.
        </p>
      </div>
      <button
        type="button"
        className="qf-workspace-notice-dismiss"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}

export function SendProposalProvider({
  children,
  data,
}: {
  children: ReactNode;
  data: SendProposalContext;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showSuccessNotice, setShowSuccessNotice] = useState(false);

  const openSendDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const handleSent = useCallback(() => {
    setOpen(false);
    setShowSuccessNotice(true);
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({
      openSendDialog,
    }),
    [openSendDialog]
  );

  return (
    <SendProposalContext.Provider value={value}>
      {showSuccessNotice ? (
        <ProposalSentNotice onDismiss={() => setShowSuccessNotice(false)} />
      ) : null}
      {children}
      <SendProposalDialog
        open={open}
        onClose={() => setOpen(false)}
        onSent={handleSent}
        data={data}
      />
    </SendProposalContext.Provider>
  );
}
