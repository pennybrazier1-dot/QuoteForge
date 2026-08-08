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
  it("prefers an agreed start date over an early vague request", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "I would like it completed within a month.",
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

    expect(summary.customerAsked).toMatch(/timing/i);
    expect(summary.customerAsked).toMatch(/within a month/i);
    expect(summary.whatWasAgreed).toMatch(/12 October/i);
    expect(summary.whatWasAgreed).not.toMatch(/within a month/i);
    expect(summary.possibleImpact).toMatch(/[Tt]iming|calendar/i);
    expect(summary.recommendedAction).toBe("open_calendar");
    expect(summary.plannedStartExact).toBe("2026-10-12");
    expect(buildCalendarActionHref("p1", summary)).toContain(
      "confirmBooking=1"
    );
  });

  it("recommends updating the proposal for material or scope requests", () => {
    const summary = buildConversationResolutionSummary([
      msg({
        id: "c1",
        kind: "change_request",
        body: "Please use oak materials and add tiling in the hallway.",
        created_at: "2026-08-08T10:00:00.000Z",
      }),
    ]);

    expect(summary.recommendedAction).toBe("update_proposal");
    expect(summary.possibleImpact).toMatch(/[Ss]cope|materials/i);
  });
});
