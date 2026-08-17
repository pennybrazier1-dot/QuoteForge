import { describe, expect, it } from "vitest";
import {
  getCalendarBookingTone,
  isCalendarEligibleProposal,
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

  it("includes accepted jobs with actual dates", () => {
    expect(isCalendarEligibleProposal("booked", "2026-10-12")).toBe(true);
    expect(getCalendarBookingTone("booked", "provisional")).toBe("provisional");
    expect(getCalendarBookingTone("booked", "confirmed")).toBe("confirmed");
  });
});
