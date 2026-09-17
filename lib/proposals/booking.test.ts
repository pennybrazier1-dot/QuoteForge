import { describe, expect, it } from "vitest";
import {
  getCalendarBookingTone,
  isCalendarEligibleProposal,
  isCalendarHoldEligible,
} from "@/lib/proposals/booking";

describe("proposal job calendar eligibility", () => {
  it("excludes proposal discussions before customer acceptance", () => {
    expect(
      isCalendarEligibleProposal("waiting_for_customer", "2026-10-12")
    ).toBe(false);
    expect(
      isCalendarEligibleProposal("needs_attention", "2026-10-12")
    ).toBe(false);
    expect(getCalendarBookingTone("waiting_for_customer", "provisional")).toBeNull();
    expect(getCalendarBookingTone("needs_attention", "provisional")).toBeNull();
  });

  it("includes accepted jobs only when the date is confirmed", () => {
    expect(isCalendarEligibleProposal("booked", "2026-10-12")).toBe(false);
    expect(
      isCalendarEligibleProposal("booked", "2026-10-12", "confirmed")
    ).toBe(true);
    expect(getCalendarBookingTone("booked", "provisional")).toBe("provisional");
    expect(getCalendarBookingTone("booked", "confirmed")).toBe("confirmed");
  });

  it("treats an explicit hold as a calendar hold, not a job", () => {
    expect(
      isCalendarHoldEligible(
        "needs_attention",
        "2026-08-12",
        "10:30",
        "provisional"
      )
    ).toBe(true);
    expect(
      isCalendarHoldEligible(
        "waiting_for_customer",
        "2026-08-12",
        "10:30",
        "provisional"
      )
    ).toBe(true);
    expect(
      isCalendarHoldEligible("needs_attention", "2026-08-12", "10:30")
    ).toBe(false);
    expect(isCalendarHoldEligible("needs_attention", "2026-08-12", null)).toBe(
      false
    );
    expect(
      isCalendarHoldEligible("booked", "2026-08-12", "10:30", "confirmed")
    ).toBe(false);
  });
});
