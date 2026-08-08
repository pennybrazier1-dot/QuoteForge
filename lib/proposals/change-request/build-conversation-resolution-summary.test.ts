import { describe, expect, it } from "vitest";
import {
  buildCalendarActionHref,
  buildConversationResolutionSummary,
} from "@/lib/proposals/change-request/build-conversation-resolution-summary";
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

describe("buildConversationResolutionSummary", () => {
  it("surfaces the original request and quietly prefills an agreed date", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "Would like the work completed within a month.",
          created_at: "2026-08-08T10:00:00.000Z",
        }),
        msg({
          id: "t1",
          kind: "trader_reply",
          body: "I can do 12 October if that works.",
          created_at: "2026-08-08T11:00:00.000Z",
        }),
        msg({
          id: "c2",
          kind: "question",
          body: "Yes, that date is fine.",
          created_at: "2026-08-08T12:00:00.000Z",
        }),
      ],
      new Date("2026-08-08T12:00:00.000Z")
    );

    expect(summary.customerRequest).toMatch(/timing/i);
    expect(summary.originalRequestWording).toMatch(/within a month/i);
    expect(summary.plannedStartExact).toBe("2026-10-12");
    expect(buildCalendarActionHref("p1", summary)).toContain(
      "/proposals/p1/schedule"
    );
    expect(buildCalendarActionHref("p1", summary)).toContain(
      "suggestedDateExact=2026-10-12"
    );
  });

  it("describes material/scope requests without choosing a next action for the trader", () => {
    const summary = buildConversationResolutionSummary([
      msg({
        id: "c1",
        kind: "change_request",
        body: "Please use oak materials and add tiling in the hallway.",
        created_at: "2026-08-08T10:00:00.000Z",
      }),
    ]);

    expect(summary.customerRequest).toMatch(/scope|materials/i);
    expect(summary.originalRequestWording).toMatch(/oak/i);
    expect(summary.plannedStartExact).toBeNull();
  });
});
