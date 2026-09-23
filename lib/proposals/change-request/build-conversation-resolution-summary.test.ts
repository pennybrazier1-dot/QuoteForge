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
    expect(summary.showUpdateProposal).toBe(true);
    expect(summary.mobileHeadline).toBe("Customer requested a change to the job");
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
    expect(summary.showUpdateProposal).toBe(false);
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
    expect(summary.hasDateAgreement).toBe(true);
    expect(summary.resolutionFocus).toBe("date_agreed");
    expect(summary.mobileHeadline).toBe("Date agreed");
    expect(summary.mobileDescription).toBe("Monday 12 October");
    expect(summary.calendarAction).toBe("hold");
    expect(buildCalendarActionHref("p1", summary)).toContain(
      "suggestedDateExact=2026-10-12"
    );
    expect(buildCalendarActionHref("p1", summary)).toContain("mode=hold");
  });

  it("shows the agreed date and time on the mobile attention card", () => {
    const summary = buildConversationResolutionSummary(
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

    expect(summary.resolutionFocus).toBe("date_agreed");
    expect(summary.mobileHeadline).toBe("Date agreed");
    expect(summary.mobileDescription).toBe("Wednesday 12 August · 10:30");
    expect(summary.plannedStartExact).toBe("2026-08-12");
    expect(summary.plannedStartTime).toBe("10:30");
    expect(summary.calendarAction).toBe("hold");
    expect(buildCalendarActionHref("p1", summary)).toContain("suggestedTime=10%3A30");
  });

  it("schedules a job when the proposal is already accepted", () => {
    const summary = buildConversationResolutionSummary(
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
      new Date("2026-08-08T12:00:00.000Z"),
      { proposalAccepted: true }
    );

    expect(summary.calendarAction).toBe("schedule");
    expect(buildCalendarActionHref("p1", summary)).not.toContain("mode=hold");
  });

  it("shows a discussed date without treating it as agreed", () => {
    const summary = buildConversationResolutionSummary(
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

    expect(summary.hasDateAgreement).toBe(false);
    expect(summary.resolutionFocus).toBe("date_discussed");
    expect(summary.mobileHeadline).toBe("Date discussed");
    expect(summary.mobileDescription).toBe("Wednesday 12 August · 10:30");
    expect(summary.showDateActions).toBe(true);
    expect(summary.canActOnSlot).toBe(true);
  });

  it("hides date actions after the same slot is already held or confirmed", () => {
    const messages = [
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
    ];

    const held = buildConversationResolutionSummary(
      messages,
      new Date("2026-08-08T12:00:00.000Z"),
      {
        dateState: "provisional",
        persistedDate: "2026-08-12",
        persistedTime: "10:30",
      }
    );
    expect(held.showDateActions).toBe(false);

    const confirmed = buildConversationResolutionSummary(
      messages,
      new Date("2026-08-08T12:00:00.000Z"),
      {
        dateState: "confirmed",
        persistedDate: "2026-08-12",
        persistedTime: "10:30",
      }
    );
    expect(confirmed.showDateActions).toBe(false);
    expect(confirmed.hasActiveAttention).toBe(false);
    expect(confirmed.customerRequestItems.some((item) => /date/i.test(item))).toBe(
      false
    );
  });

  it("keeps other unresolved work when a date request is already resolved", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "May need door changed.",
          created_at: "2026-08-08T10:00:00.000Z",
        }),
        msg({
          id: "c2",
          kind: "change_request",
          body: "Can we move the start date to 12 August at 10:30?",
          created_at: "2026-08-08T10:05:00.000Z",
        }),
        msg({
          id: "t1",
          kind: "trader_reply",
          body: "I can do 12 August at 10:30.",
          created_at: "2026-08-08T11:00:00.000Z",
        }),
        msg({
          id: "c3",
          kind: "question",
          body: "12 August at 10:30 works for me.",
          created_at: "2026-08-08T12:00:00.000Z",
        }),
      ],
      new Date("2026-08-08T12:00:00.000Z"),
      {
        dateState: "confirmed",
        persistedDate: "2026-08-12",
        persistedTime: "10:30",
      }
    );

    expect(summary.showDateActions).toBe(false);
    expect(summary.hasActiveAttention).toBe(true);
    expect(summary.customerRequestItems).toEqual(
      expect.arrayContaining(["Door change"])
    );
    expect(
      summary.customerRequestItems.some((item) => /date|timing/i.test(item))
    ).toBe(false);
  });

  it("surfaces a customer requested date so the trader can accept it", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "d1",
          kind: "change_request",
          body: "I'd like a different date/time.\nRequested date: 2026-10-13\nRequested time: 14:00\nMornings are better.",
          created_at: "2026-08-08T12:00:00.000Z",
        }),
      ],
      new Date("2026-08-08T12:00:00.000Z"),
      { attentionReason: "customer_requested_date_change" }
    );

    expect(summary.requestedStartExact).toBe("2026-10-13");
    expect(summary.requestedStartTime).toBe("14:00");
    expect(summary.showAcceptRequestedDate).toBe(true);
    expect(summary.requestedDisplayValue).toBe("13 October 2026 · 2:00pm");
    expect(summary.mobileHeadline).toBe("Customer requested a date & time change");
    expect(summary.customerRequestItems).not.toEqual(
      expect.arrayContaining(["Timing / date change"])
    );
  });

  it("displays the exact requested time from a spoken time change", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "Could we do 2:30pm instead?",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
      new Date("2026-09-18T10:00:00.000Z"),
      {
        attentionReason: "customer_requested_date_change",
        persistedDate: "2026-09-20",
        persistedTime: "09:00",
      }
    );

    expect(summary.requestedKind).toBe("time");
    expect(summary.requestedDisplayValue).toBe("2:30pm");
    expect(summary.requestedStartTime).toBe("14:30");
    expect(summary.mobileHeadline).toBe("Customer requested a time change");
    expect(summary.customerRequestItems).toContain("2:30pm");
    expect(summary.customerRequestItems).not.toContain("Timing / date change");
  });

  it("displays the exact requested date from a spoken date change", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "Can we move it to the 24th of September?",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
      new Date("2026-09-18T10:00:00.000Z")
    );

    expect(summary.requestedKind).toBe("date");
    expect(summary.requestedDisplayValue).toBe("24 September 2026");
    expect(summary.requestedStartExact).toBe("2026-09-24");
    expect(summary.mobileHeadline).toBe("Customer requested a date change");
  });

  it("displays date and time together when both were requested", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "Could we do 24 September at 2:30pm?",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
      new Date("2026-09-18T10:00:00.000Z")
    );

    expect(summary.requestedKind).toBe("date_time");
    expect(summary.requestedDisplayValue).toBe("24 September 2026 · 2:30pm");
    expect(summary.mobileHeadline).toBe(
      "Customer requested a date & time change"
    );
  });

  it("marks a free requested slot as available without naming other jobs", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "Could we do 24 September at 2:30pm?",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
      new Date("2026-09-18T10:00:00.000Z"),
      {
        proposalId: "current",
        calendarJobs: [
          {
            id: "other",
            proposalId: "other",
            href: "/proposals/other",
            title: "Secret bathroom",
            customer: "Hidden customer",
            startDate: "2026-09-20",
            endDate: "2026-09-20",
            spanDates: ["2026-09-20"],
            dateLabel: "20 Sep",
            tone: "confirmed",
          },
        ],
      }
    );

    expect(summary.requestedAvailability).toBe("available");
    expect(summary.showAcceptRequestedDate).toBe(true);
    expect(JSON.stringify(summary)).not.toMatch(/Hidden customer|Secret bathroom/);
  });

  it("marks a conflicting requested slot as unavailable", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "Could we do 24 September at 2:30pm?",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
      new Date("2026-09-18T10:00:00.000Z"),
      {
        proposalId: "current",
        calendarJobs: [
          {
            id: "other",
            proposalId: "other",
            href: "/proposals/other",
            title: "Secret bathroom",
            customer: "Hidden customer",
            startDate: "2026-09-24",
            endDate: "2026-09-24",
            spanDates: ["2026-09-24"],
            dateLabel: "24 Sep",
            tone: "confirmed",
          },
        ],
      }
    );

    expect(summary.requestedAvailability).toBe("unavailable");
    expect(summary.showAcceptRequestedDate).toBe(false);
    expect(JSON.stringify(summary)).not.toMatch(/Hidden customer|Secret bathroom/);
  });

  it("does not turn running-late conversation into a change request", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "question",
          body: "I'm running 20 minutes late",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
      new Date("2026-09-18T10:00:00.000Z")
    );

    expect(summary.hasActiveAttention).toBe(false);
    expect(summary.hasScheduleRequest).toBe(false);
    expect(summary.requestedDisplayValue).toBeNull();
    expect(summary.showUpdateProposal).toBe(false);
  });

  it("shows a job-detail change separately from timing", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "Please add two extra sockets.",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
      new Date("2026-09-18T10:00:00.000Z")
    );

    expect(summary.hasJobRequest).toBe(true);
    expect(summary.hasScheduleRequest).toBe(false);
    expect(summary.mobileHeadline).toBe("Customer requested a change to the job");
    expect(summary.outstandingItems).toEqual([
      expect.objectContaining({
        kind: "job",
        title: "Job details",
      }),
    ]);
  });

  it("shows combined job and date requests as separate outstanding items", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "Please add two extra sockets.",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
        msg({
          id: "c2",
          kind: "change_request",
          body: "Could we do 24 September at 2:30pm?",
          created_at: "2026-09-18T10:05:00.000Z",
        }),
      ],
      new Date("2026-09-18T10:00:00.000Z")
    );

    expect(summary.hasJobRequest).toBe(true);
    expect(summary.hasScheduleRequest).toBe(true);
    expect(summary.mobileHeadline).toBe("Requested changes");
    expect(summary.outstandingItems).toEqual([
      {
        kind: "schedule",
        title: "Date/time",
        detail: "24 September 2026 · 2:30pm",
      },
      expect.objectContaining({
        kind: "job",
        title: "Job details",
        detail: "Add two extra sockets",
      }),
    ]);
    expect(summary.customerRequest).not.toMatch(/additional work, time\/date change/i);
  });

  it("prefers structured requested fields over later spoken wording", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "I'd like a different date/time.\nRequested date: 2026-09-24\nRequested time: 14:30\nMaybe the 20th instead if easier.",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
      new Date("2026-09-18T10:00:00.000Z"),
      { attentionReason: "customer_requested_date_change" }
    );

    expect(summary.requestedStartExact).toBe("2026-09-24");
    expect(summary.requestedStartTime).toBe("14:30");
    expect(summary.requestedDisplayValue).toBe("24 September 2026 · 2:30pm");
    expect(summary.requestedStartExact).not.toBe("2026-09-20");
    expect(summary.requestedDisplayValue).not.toMatch(/20 September/);
  });

  it("never invents a date or time when the request is vague", () => {
    const summary = buildConversationResolutionSummary(
      [
        msg({
          id: "c1",
          kind: "change_request",
          body: "Can we move the start date to next month?",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
      new Date("2026-09-18T10:00:00.000Z")
    );

    expect(summary.requestedDisplayValue).toBeNull();
    expect(summary.requestedStartExact).toBeNull();
    expect(summary.requestedStartTime).toBeNull();
    expect(summary.mobileHeadline).toBe("Customer requested a date change");
    expect(summary.mobileDescription).not.toMatch(/\d{1,2}\s+September/);
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
