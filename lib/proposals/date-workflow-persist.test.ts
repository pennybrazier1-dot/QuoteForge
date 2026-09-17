import { describe, expect, it } from "vitest";
import { hasOtherUnresolvedWorkRequests } from "@/lib/proposals/date-workflow-persist";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";

function msg(
  partial: Partial<ProposalCustomerMessage> &
    Pick<ProposalCustomerMessage, "id" | "kind" | "body" | "created_at">
): ProposalCustomerMessage {
  return {
    direction: partial.kind === "trader_reply" ? "trader" : "customer",
    created_by: null,
    ...partial,
  };
}

describe("hasOtherUnresolvedWorkRequests", () => {
  it("ignores date-only conversation when resolving a date request", () => {
    expect(
      hasOtherUnresolvedWorkRequests([
        msg({
          id: "c1",
          kind: "change_request",
          body: "Can we do 12 August at 10:30?",
          created_at: "2026-08-08T10:00:00.000Z",
        }),
      ])
    ).toBe(false);
  });

  it("keeps Needs Attention when scope work is still outstanding", () => {
    expect(
      hasOtherUnresolvedWorkRequests([
        msg({
          id: "c1",
          kind: "change_request",
          body: "Please add a double shower as well.",
          created_at: "2026-08-08T10:00:00.000Z",
        }),
      ])
    ).toBe(true);
  });
});
