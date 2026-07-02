import { describe, expect, it } from "vitest";
import { buildCalendarJobs, type CalendarProposal } from "@/lib/calendar/calendar-data";
import {
  getCalendarBookingTone,
  isCalendarEligibleProposal,
  isConfirmedBooking,
  isProvisionalBooking,
} from "@/lib/proposals/booking";

function makeProposal(
  overrides: Partial<CalendarProposal> & Pick<CalendarProposal, "id" | "status">
): CalendarProposal {
  return {
    proposal_number: "QF-001",
    customer_name: "Test Customer",
    title: "Bathroom refit",
    job_summary: null,
    rough_notes: null,
    booking_confirmation: null,
    planned_start_date: "2026-09-15",
    planned_start_date_text: "15 September 2026",
    estimated_duration: "2 days",
    things_to_confirm: null,
    job_address: null,
    ...overrides,
  };
}

describe("calendar booking tones", () => {
  it("shows waiting_for_customer as provisional on the calendar", () => {
    expect(
      getCalendarBookingTone("waiting_for_customer", null)
    ).toBe("provisional");
  });

  it("excludes ready_to_send from the calendar", () => {
    expect(
      isCalendarEligibleProposal("ready_to_send", "2026-09-15")
    ).toBe(false);
  });

  it("includes sent quotes with a planned start date", () => {
    expect(
      isCalendarEligibleProposal("waiting_for_customer", "2026-09-15")
    ).toBe(true);
  });

  it("marks booked + confirmed as green confirmed booking", () => {
    expect(isConfirmedBooking("booked", "confirmed")).toBe(true);
    expect(getCalendarBookingTone("booked", "confirmed")).toBe("confirmed");
  });

  it("marks booked + provisional as amber provisional booking", () => {
    expect(isProvisionalBooking("booked", "provisional")).toBe(true);
    expect(getCalendarBookingTone("booked", "provisional")).toBe("provisional");
  });
});

describe("buildCalendarJobs", () => {
  it("builds provisional and confirmed jobs from proposals", () => {
    const jobs = buildCalendarJobs([
      makeProposal({
        id: "waiting-1",
        status: "waiting_for_customer",
      }),
      makeProposal({
        id: "booked-confirmed",
        status: "booked",
        booking_confirmation: "confirmed",
      }),
      makeProposal({
        id: "booked-provisional",
        status: "booked",
        booking_confirmation: "provisional",
      }),
      makeProposal({
        id: "ready",
        status: "ready_to_send",
      }),
    ]);

    expect(jobs).toHaveLength(3);
    expect(jobs.find((job) => job.id === "waiting-1")?.tone).toBe("provisional");
    expect(jobs.find((job) => job.id === "booked-confirmed")?.tone).toBe(
      "confirmed"
    );
    expect(jobs.find((job) => job.id === "booked-provisional")?.tone).toBe(
      "provisional"
    );
    expect(jobs.find((job) => job.id === "ready")).toBeUndefined();
  });

  it("spans multi-day jobs across each calendar day", () => {
    const jobs = buildCalendarJobs([
      makeProposal({
        id: "multi-day",
        status: "booked",
        booking_confirmation: "confirmed",
        estimated_duration: "3 days",
        planned_start_date: "2026-09-15",
      }),
    ]);

    expect(jobs[0]?.spanDates).toEqual([
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
    ]);
  });
});
