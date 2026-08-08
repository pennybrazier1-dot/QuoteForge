import { describe, expect, it } from "vitest";
import {
  buildCalendarActionHref,
  buildConversationResolutionSummary,
  requestItemTitleFromMessage,
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
  it("aggregates multiple customer requests from the full thread", () => {
    const summary = buildConversationResolutionSummary([
      msg({
        id: "c1",
        kind: "change_request",
        body: "May need door changed.",
        created_at: "2026-08-08T10:00:00.000Z",
      }),
      msg({
        id: "c2",
        kind: "change_request",
        body: "Also wants double shower added.",
        created_at: "2026-08-08T10:05:00.000Z",
      }),
    ]);

    expect(summary.customerRequestItems).toEqual(
      expect.arrayContaining(["Door change", "Add double shower"])
    );
    expect(summary.customerRequestItems).toHaveLength(2);
    expect(summary.originalRequestWording).toMatch(/door changed/i);
    expect(summary.originalRequestWording).toMatch(/double shower/i);
    expect(summary.possibleImpacts).toEqual(
      expect.arrayContaining(["Scope change", "Price review"])
    );
    expect(summary.resolutionFocus).toBe("update");
    expect(summary.mobileHeadline).toBe("Customer requested additional work");
  });

  it("uses a date-focused mobile next step for timing-only requests", () => {
    const summary = buildConversationResolutionSummary([
      msg({
        id: "c1",
        kind: "change_request",
        body: "Can we move the start date to next month?",
        created_at: "2026-08-08T10:00:00.000Z",
      }),
    ]);

    expect(summary.resolutionFocus).toBe("date");
    expect(summary.mobileHeadline).toBe("Customer requested a date change");
    expect(summary.mobileDescription.length).toBeGreaterThan(0);
  });

  it("quietly prefills an agreed date without losing earlier requests", () => {
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

    expect(summary.customerRequestItems.some((item) => /timing|date/i.test(item))).toBe(
      true
    );
    expect(summary.plannedStartExact).toBe("2026-10-12");
    expect(buildCalendarActionHref("p1", summary)).toContain(
      "suggestedDateExact=2026-10-12"
    );
  });
});

describe("requestItemTitleFromMessage", () => {
  it("titles common scope requests clearly", () => {
    expect(requestItemTitleFromMessage("May need door changed.")).toBe(
      "Door change"
    );
    expect(requestItemTitleFromMessage("Also wants double shower added.")).toBe(
      "Add double shower"
    );
  });
});
