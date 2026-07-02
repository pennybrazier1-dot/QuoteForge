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
  title,
  body,
  onDismiss,
}: {
  title: string;
  body: string;
  onDismiss: () => void;
}) {
  return (
    <div className="qf-workspace-notice qf-workspace-notice-success" role="status">
      <div>
        <p className="qf-workspace-notice-title">{title}</p>
        <p className="qf-workspace-notice-body">{body}</p>
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
  devTestingEnabled = false,
}: {
  children: ReactNode;
  data: SendProposalContext;
  devTestingEnabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<{
    title: string;
    body: string;
  } | null>(null);

  const openSendDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const handleSent = useCallback(
    (options?: { simulated?: boolean; message?: string }) => {
      setOpen(false);
      setNotice(
        options?.simulated
          ? {
              title: options.message ?? "Test send complete",
              body: "Status updated to Waiting for Customer. No email was sent.",
            }
          : {
              title: "Proposal sent successfully",
              body: "Your proposal has been emailed to the customer.",
            }
      );
      router.refresh();
    },
    [router]
  );

  const value = useMemo(
    () => ({
      openSendDialog,
    }),
    [openSendDialog]
  );

  return (
    <SendProposalContext.Provider value={value}>
      {notice ? (
        <ProposalSentNotice
          title={notice.title}
          body={notice.body}
          onDismiss={() => setNotice(null)}
        />
      ) : null}
      {children}
      <SendProposalDialog
        open={open}
        onClose={() => setOpen(false)}
        onSent={handleSent}
        data={data}
        devTestingEnabled={devTestingEnabled}
      />
    </SendProposalContext.Provider>
  );
}
