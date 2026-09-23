import { describe, expect, it } from "vitest";
import type { CalendarJob } from "@/lib/calendar/calendar-data";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import {
  extractRequestedSchedule,
  formatRequestedSlotDisplay,
  requestedSlotAvailability,
} from "@/lib/proposals/change-request/requested-schedule";

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

function job(overrides: Partial<CalendarJob> & Pick<CalendarJob, "id" | "spanDates">): CalendarJob {
  return {
    proposalId: overrides.id,
    href: `/proposals/${overrides.id}`,
    title: "Other job",
    customer: "Other customer",
    startDate: overrides.spanDates[0] ?? "2026-09-20",
    endDate: overrides.spanDates[overrides.spanDates.length - 1] ?? "2026-09-20",
    dateLabel: "20 Sep",
    tone: "confirmed",
    ...overrides,
  };
}

describe("extractRequestedSchedule", () => {
  it("reads structured date and time fields first", () => {
    const slot = extractRequestedSchedule({
      messages: [
        msg({
          id: "c1",
          kind: "change_request",
          body: "I'd like a different date.\nRequested date: 2026-09-24\nRequested time: 14:30",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
    });

    expect(slot.source).toBe("structured_message");
    expect(slot.dateIso).toBe("2026-09-24");
    expect(slot.timeHm).toBe("14:30");
    expect(slot.displayValue).toBe("24 September 2026 · 2:30pm");
  });

  it("uses event metadata when the message has no structured fields", () => {
    const slot = extractRequestedSchedule({
      messages: [
        msg({
          id: "c1",
          kind: "change_request",
          body: "I'd like a different time.",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
      events: [
        {
          created_at: "2026-09-18T10:00:00.000Z",
          metadata: {
            requested_date: "2026-09-24",
            requested_time: "14:30",
          },
        },
      ],
    });

    expect(slot.source).toBe("event_metadata");
    expect(slot.displayValue).toBe("24 September 2026 · 2:30pm");
  });

  it("parses spoken text only when no structured value exists", () => {
    const slot = extractRequestedSchedule({
      messages: [
        msg({
          id: "c1",
          kind: "change_request",
          body: "Could we do 2:30pm instead?",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
      now: new Date("2026-09-18T10:00:00.000Z"),
    });

    expect(slot.source).toBe("parsed_message");
    expect(slot.kind).toBe("time");
    expect(slot.displayValue).toBe("2:30pm");
    expect(slot.dateIso).toBeNull();
  });

  it("never invents a missing exact value", () => {
    const slot = extractRequestedSchedule({
      messages: [
        msg({
          id: "c1",
          kind: "change_request",
          body: "Can we move the job to next month?",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
      now: new Date("2026-09-18T10:00:00.000Z"),
    });

    expect(slot.dateIso).toBeNull();
    expect(slot.timeHm).toBeNull();
    expect(slot.displayValue).toBeNull();
    expect(formatRequestedSlotDisplay({})).toBeNull();
  });

  it("does not parse ordinary late conversation as a requested slot", () => {
    const slot = extractRequestedSchedule({
      messages: [
        msg({
          id: "c1",
          kind: "question",
          body: "I'm running 20 minutes late",
          created_at: "2026-09-18T10:00:00.000Z",
        }),
      ],
    });

    expect(slot.kind).toBeNull();
    expect(slot.displayValue).toBeNull();
  });
});

describe("requestedSlotAvailability", () => {
  it("returns available when the diary is free", () => {
    expect(
      requestedSlotAvailability({
        dateIso: "2026-09-24",
        proposalId: "current",
        existingJobs: [job({ id: "other", spanDates: ["2026-09-20"] })],
      })
    ).toBe("available");
  });

  it("returns unavailable when another confirmed job clashes", () => {
    expect(
      requestedSlotAvailability({
        dateIso: "2026-09-24",
        proposalId: "current",
        existingJobs: [job({ id: "other", spanDates: ["2026-09-24"] })],
      })
    ).toBe("unavailable");
  });

  it("returns unknown when no exact date exists", () => {
    expect(
      requestedSlotAvailability({
        dateIso: null,
        existingJobs: [job({ id: "other", spanDates: ["2026-09-24"] })],
      })
    ).toBe("unknown");
  });
});
