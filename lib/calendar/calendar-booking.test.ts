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
  it("keeps waiting_for_customer off the actual job calendar", () => {
    expect(
      getCalendarBookingTone("waiting_for_customer", null)
    ).toBeNull();
  });

  it("excludes ready_to_send from the calendar", () => {
    expect(
      isCalendarEligibleProposal("ready_to_send", "2026-09-15")
    ).toBe(false);
  });

  it("excludes sent quotes with rough timing from the job calendar", () => {
    expect(
      isCalendarEligibleProposal("waiting_for_customer", "2026-09-15")
    ).toBe(false);
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
  it("builds only accepted jobs from proposals", () => {
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

    expect(jobs).toHaveLength(1);
    expect(jobs.find((job) => job.id === "waiting-1")).toBeUndefined();
    expect(jobs.find((job) => job.id === "booked-confirmed")?.tone).toBe(
      "confirmed"
    );
    expect(jobs.find((job) => job.id === "booked-provisional")).toBeUndefined();
    expect(jobs.find((job) => job.id === "ready")).toBeUndefined();
  });

  it("shows a provisional hold in the calendar", () => {
    const jobs = buildCalendarJobs([
      makeProposal({
        id: "held-date",
        status: "needs_attention",
        booking_confirmation: "provisional",
        planned_start_date: "2026-08-12",
        planned_start_time: "10:30",
      }),
    ]);

    expect(jobs).toHaveLength(1);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.kind).toBe("proposal_hold");
    expect(jobs[0]?.tone).toBe("provisional");
    expect(jobs[0]?.badgeLabel).toBe("Hold");
  });

  it("promotes a hold to one booked job instead of adding a second record", () => {
    const hold = makeProposal({
      id: "same-slot",
      status: "waiting_for_customer",
      booking_confirmation: "provisional",
      planned_start_date: "2026-08-12",
      planned_start_time: "10:30",
    });
    const booked = makeProposal({
      id: "same-slot",
      status: "booked",
      booking_confirmation: "confirmed",
      planned_start_date: "2026-08-12",
      planned_start_time: "10:30",
    });

    expect(buildCalendarJobs([hold])).toHaveLength(1);
    expect(buildCalendarJobs([booked])).toHaveLength(1);
    expect(buildCalendarJobs([booked])[0]?.kind).toBe("proposal");
    expect(buildCalendarJobs([booked])[0]?.tone).toBe("confirmed");
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
