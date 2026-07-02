import { describe, expect, it } from "vitest";
import {
  analyzeBookingClashes,
  findNextAvailableStartDate,
} from "@/lib/calendar/clash-detection";
import type { CalendarJob } from "@/lib/calendar/calendar-data";

function makeJob(
  overrides: Partial<CalendarJob> & Pick<CalendarJob, "id" | "tone" | "spanDates">
): CalendarJob {
  return {
    proposalId: overrides.id,
    href: `/proposals/${overrides.id}`,
    title: "Existing job",
    customer: "Customer",
    startDate: overrides.spanDates[0] ?? "2026-09-15",
    endDate: overrides.spanDates[overrides.spanDates.length - 1] ?? "2026-09-15",
    dateLabel: "15 Sep",
    ...overrides,
  };
}

describe("analyzeBookingClashes", () => {
  const existingJobs: CalendarJob[] = [
    makeJob({
      id: "confirmed-job",
      tone: "confirmed",
      spanDates: ["2026-09-15", "2026-09-16"],
    }),
    makeJob({
      id: "provisional-job",
      tone: "provisional",
      spanDates: ["2026-09-22"],
    }),
  ];

  it("flags confirmed overlapping confirmed as a strong clash", () => {
    const analysis = analyzeBookingClashes(
      {
        proposalId: "new-job",
        startDateIso: "2026-09-15",
        duration: "1 day",
        bookingStatus: "confirmed",
      },
      existingJobs
    );

    expect(analysis.hasStrongOrWarning).toBe(true);
    expect(analysis.clashes[0]?.severity).toBe("strong");
    expect(analysis.clashes[0]?.message).toBe(
      "You already have a confirmed job on this date."
    );
  });

  it("flags provisional overlapping confirmed as a warning", () => {
    const analysis = analyzeBookingClashes(
      {
        proposalId: "new-job",
        startDateIso: "2026-09-15",
        duration: "1 day",
        bookingStatus: "provisional",
      },
      existingJobs
    );

    expect(analysis.clashes[0]?.severity).toBe("warning");
    expect(analysis.clashes[0]?.message).toBe(
      "You already have a confirmed job on this date."
    );
  });

  it("flags provisional overlapping provisional in the same week as soft", () => {
    const analysis = analyzeBookingClashes(
      {
        proposalId: "new-job",
        startDateIso: "2026-09-24",
        duration: "1 day",
        bookingStatus: "provisional",
      },
      existingJobs
    );

    expect(analysis.hasSoft).toBe(true);
    expect(analysis.clashes[0]?.severity).toBe("soft");
    expect(analysis.clashes[0]?.message).toBe(
      "You may be double-booking this week."
    );
  });

  it("warns when confirmed booking overlaps a provisional hold", () => {
    const analysis = analyzeBookingClashes(
      {
        proposalId: "new-job",
        startDateIso: "2026-09-22",
        duration: "1 day",
        bookingStatus: "confirmed",
      },
      existingJobs
    );

    expect(analysis.clashes[0]?.severity).toBe("warning");
    expect(analysis.clashes[0]?.message).toBe(
      "This date is provisionally held for another job."
    );
  });

  it("suggests the next date without a confirmed clash", () => {
    const analysis = analyzeBookingClashes(
      {
        proposalId: "new-job",
        startDateIso: "2026-09-15",
        duration: "1 day",
        bookingStatus: "confirmed",
      },
      existingJobs
    );

    expect(analysis.suggestedStartDate).toBe("2026-09-17");
  });

  it("ignores clashes with the same proposal id", () => {
    const analysis = analyzeBookingClashes(
      {
        proposalId: "confirmed-job",
        startDateIso: "2026-09-15",
        duration: "1 day",
        bookingStatus: "confirmed",
      },
      existingJobs
    );

    expect(analysis.clashes).toHaveLength(0);
  });
});

describe("findNextAvailableStartDate", () => {
  it("skips dates covered by confirmed jobs", () => {
    const next = findNextAvailableStartDate(
      [
        makeJob({
          id: "busy",
          tone: "confirmed",
          spanDates: ["2026-09-15", "2026-09-16"],
        }),
      ],
      1,
      "2026-09-15"
    );

    expect(next).toBe("2026-09-17");
  });
});
