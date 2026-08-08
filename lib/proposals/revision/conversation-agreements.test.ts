import { describe, expect, it } from "vitest";
import {
  findLatestConfirmedDateAgreement,
  parseFlexibleDateToIso,
} from "@/lib/proposals/revision/conversation-agreements";
import { buildRevisionSuggestions } from "@/lib/proposals/revision/build-revision-suggestions";
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

describe("parseFlexibleDateToIso", () => {
  it("parses day + month into the next occurrence", () => {
    const iso = parseFlexibleDateToIso(
      "12 October",
      new Date("2026-08-08T12:00:00.000Z")
    );
    expect(iso).toBe("2026-10-12");
  });
});

describe("findLatestConfirmedDateAgreement", () => {
  it("prefers confirmed trader date over earlier vague customer request", () => {
    const agreement = findLatestConfirmedDateAgreement(
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

    expect(agreement).not.toBeNull();
    expect(agreement?.dateText).toMatch(/12 October/i);
    expect(agreement?.dateIso).toBe("2026-10-12");
    expect(agreement?.evidenceQuote).toMatch(/Trader:/i);
    expect(agreement?.evidenceQuote).toMatch(/Customer:/i);
    expect(agreement?.evidenceQuote).not.toMatch(/within a month/i);
  });
});

describe("buildRevisionSuggestions agreements", () => {
  it("suggests the agreed start date instead of the original vague request", () => {
    const suggestions = buildRevisionSuggestions(
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

    const startDates = suggestions.filter((item) => item.type === "start_date");
    expect(startDates).toHaveLength(1);
    expect(startDates[0]?.resolvedValue).toMatch(/12 October/i);
    expect(startDates[0]?.resolvedDateIso).toBe("2026-10-12");
    expect(startDates[0]?.evidenceQuote).toMatch(/12 October/i);
    expect(startDates[0]?.evidenceQuote).toMatch(/Yes, that date is fine/i);
    expect(startDates[0]?.evidenceQuote).not.toMatch(/within a month/i);
    expect(startDates[0]?.suggestedChange).toMatch(/12 October/i);

    const durations = suggestions.filter((item) => item.type === "duration");
    expect(durations.length).toBeGreaterThan(0);
  });
});
