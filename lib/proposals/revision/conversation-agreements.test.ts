import { describe, expect, it } from "vitest";
import {
  extractSpecificTimeToHm,
  findLatestConfirmedDateAgreement,
  findLatestDiscussedDateSlot,
  formatAgreedSlotLabel,
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

  it("parses the 24th of September without inventing a time", () => {
    expect(
      parseFlexibleDateToIso(
        "24th of September",
        new Date("2026-09-18T10:00:00.000Z")
      )
    ).toBe("2026-09-24");
    expect(extractSpecificTimeToHm("Can we move it to the 24th of September?")).toBeNull();
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
    expect(agreement?.timeHm).toBeNull();
    expect(agreement?.evidenceQuote).toMatch(/Trader:/i);
    expect(agreement?.evidenceQuote).toMatch(/Customer:/i);
    expect(agreement?.evidenceQuote).not.toMatch(/within a month/i);
  });

  it("recognises an exact date and time restated by the customer", () => {
    const agreement = findLatestConfirmedDateAgreement(
      [
        msg({
          id: "t1",
          kind: "trader_reply",
          body: "I can do 12 August at 10:30.",
          created_at: "2026-08-08T11:00:00.000Z",
        }),
        msg({
          id: "c1",
          kind: "question",
          body: "12 August at 10:30 works for me.",
          created_at: "2026-08-08T12:00:00.000Z",
        }),
      ],
      new Date("2026-08-08T12:00:00.000Z")
    );

    expect(agreement).not.toBeNull();
    expect(agreement?.dateIso).toBe("2026-08-12");
    expect(agreement?.timeHm).toBe("10:30");
    expect(formatAgreedSlotLabel(agreement!)).toBe(
      "Wednesday 12 August · 10:30"
    );
  });

  it("recognises when the customer offers a date and the trader confirms", () => {
    const agreement = findLatestConfirmedDateAgreement(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "Can we do 12 August at 10:30?",
          created_at: "2026-08-08T10:00:00.000Z",
        }),
        msg({
          id: "t1",
          kind: "trader_reply",
          body: "Yes, 12 August at 10:30 works for me.",
          created_at: "2026-08-08T11:00:00.000Z",
        }),
      ],
      new Date("2026-08-08T12:00:00.000Z")
    );

    expect(agreement?.dateIso).toBe("2026-08-12");
    expect(agreement?.timeHm).toBe("10:30");
  });

  it("drops an earlier agreement if a later different date is still open", () => {
    const agreement = findLatestConfirmedDateAgreement(
      [
        msg({
          id: "t1",
          kind: "trader_reply",
          body: "I can do 12 August at 10:30.",
          created_at: "2026-08-08T11:00:00.000Z",
        }),
        msg({
          id: "c1",
          kind: "question",
          body: "12 August at 10:30 works for me.",
          created_at: "2026-08-08T12:00:00.000Z",
        }),
        msg({
          id: "c2",
          kind: "change_request",
          body: "Sorry, can we do 20 August instead?",
          created_at: "2026-08-08T13:00:00.000Z",
        }),
      ],
      new Date("2026-08-08T13:00:00.000Z")
    );

    expect(agreement).toBeNull();
  });

  it("does not invent agreement when a date is mentioned but not agreed", () => {
    const agreement = findLatestConfirmedDateAgreement(
      [
        msg({
          id: "t1",
          kind: "trader_reply",
          body: "I could hold Wednesday 12 August at 10:30.",
          created_at: "2026-08-08T11:00:00.000Z",
        }),
        msg({
          id: "c1",
          kind: "question",
          body: "That should work but I need to check with my electrician.",
          created_at: "2026-08-08T12:00:00.000Z",
        }),
      ],
      new Date("2026-08-08T12:00:00.000Z")
    );

    expect(agreement).toBeNull();
    const discussed = findLatestDiscussedDateSlot(
      [
        msg({
          id: "t1",
          kind: "trader_reply",
          body: "I could hold Wednesday 12 August at 10:30.",
          created_at: "2026-08-08T11:00:00.000Z",
        }),
        msg({
          id: "c1",
          kind: "question",
          body: "That should work but I need to check with my electrician.",
          created_at: "2026-08-08T12:00:00.000Z",
        }),
      ],
      new Date("2026-08-08T12:00:00.000Z")
    );
    expect(discussed?.dateIso).toBe("2026-08-12");
    expect(discussed?.timeHm).toBe("10:30");
  });

  it("does not invent an agreement when only a vague window was discussed", () => {
    const agreement = findLatestConfirmedDateAgreement([
      msg({
        id: "c1",
        kind: "change_request",
        body: "Can we move this to next month?",
        created_at: "2026-08-08T10:00:00.000Z",
      }),
      msg({
        id: "t1",
        kind: "trader_reply",
        body: "I will look at next month and come back to you.",
        created_at: "2026-08-08T11:00:00.000Z",
      }),
    ]);

    expect(agreement).toBeNull();
  });
});

describe("extractSpecificTimeToHm", () => {
  it("reads common spoken times", () => {
    expect(extractSpecificTimeToHm("I can do 12 August at 10:30.")).toBe("10:30");
    expect(extractSpecificTimeToHm("around 9am is fine")).toBe("09:00");
    expect(extractSpecificTimeToHm("10.30pm works")).toBe("22:30");
    expect(extractSpecificTimeToHm("no time mentioned")).toBeNull();
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
