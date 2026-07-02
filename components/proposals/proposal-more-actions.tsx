"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RearrangeProposalDialog } from "@/components/proposals/rearrange-proposal-dialog";

type ProposalMoreActionsProps = {
  proposalId: string;
  plannedStartDateText: string | null;
  plannedStartDate: string | null;
  estimatedDuration: string | null;
};

export function ProposalMoreActions({
  proposalId,
  plannedStartDateText,
  plannedStartDate,
  estimatedDuration,
}: ProposalMoreActionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rearrangeOpen, setRearrangeOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("rearrange") === "1") {
      setRearrangeOpen(true);
      router.replace(`/proposals/${proposalId}`, { scroll: false });
    }
  }, [proposalId, router, searchParams]);

  return (
    <RearrangeProposalDialog
      open={rearrangeOpen}
      onClose={() => setRearrangeOpen(false)}
      proposalId={proposalId}
      plannedStartDateText={plannedStartDateText}
      plannedStartDate={plannedStartDate}
      estimatedDuration={estimatedDuration}
    />
  );
}
