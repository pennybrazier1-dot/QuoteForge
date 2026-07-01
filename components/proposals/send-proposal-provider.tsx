"use client";

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

export function SendProposalProvider({
  children,
  data,
}: {
  children: ReactNode;
  data: SendProposalContext;
}) {
  const [open, setOpen] = useState(false);

  const openSendDialog = useCallback(() => {
    setOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      openSendDialog,
    }),
    [openSendDialog]
  );

  return (
    <SendProposalContext.Provider value={value}>
      {children}
      <SendProposalDialog
        open={open}
        onClose={() => setOpen(false)}
        data={data}
      />
    </SendProposalContext.Provider>
  );
}
