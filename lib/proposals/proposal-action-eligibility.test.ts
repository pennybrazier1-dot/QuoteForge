import { describe, expect, it } from "vitest";
import {
  canShowResendWaitingProposal,
  getResendWaitingEnablement,
  resolveResendCustomerEmail,
} from "@/lib/proposals/proposal-action-eligibility";

describe("resend waiting enablement", () => {
  it("enables Resend when waiting_for_customer and an email exists", () => {
    const result = getResendWaitingEnablement({
      status: "waiting_for_customer",
      customerEmail: "michael@example.com",
    });
    expect(canShowResendWaitingProposal("waiting_for_customer")).toBe(true);
    expect(result.shown).toBe(true);
    expect(result.enabled).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("disables Resend when waiting_for_customer but no email exists", () => {
    const result = getResendWaitingEnablement({
      status: "waiting_for_customer",
      customerEmail: null,
      linkedCustomerEmail: null,
    });
    expect(result.shown).toBe(true);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("no_email");
  });

  it("keeps Resend enabled when the date is confirmed and an email exists", () => {
    const result = getResendWaitingEnablement({
      status: "waiting_for_customer",
      customerEmail: "michael@example.com",
      bookingConfirmation: "confirmed",
      acceptedAt: null,
      sentAt: "2026-08-08T12:00:00.000Z",
    });
    expect(result.enabled).toBe(true);
  });

  it("uses the linked customer email when the proposal snapshot has none", () => {
    expect(
      resolveResendCustomerEmail(null, "linked@example.com")
    ).toBe("linked@example.com");
    const result = getResendWaitingEnablement({
      status: "waiting_for_customer",
      customerEmail: null,
      linkedCustomerEmail: "linked@example.com",
    });
    expect(result.enabled).toBe(true);
  });

  it("does not show Resend on an accepted or closed proposal", () => {
    expect(
      getResendWaitingEnablement({
        status: "booked",
        customerEmail: "michael@example.com",
      }).shown
    ).toBe(false);
    expect(
      getResendWaitingEnablement({
        status: "declined",
        customerEmail: "michael@example.com",
      }).shown
    ).toBe(false);
    expect(canShowResendWaitingProposal("booked")).toBe(false);
  });

  it("temporarily disables Resend while a send is in progress", () => {
    const result = getResendWaitingEnablement({
      status: "waiting_for_customer",
      customerEmail: "michael@example.com",
      sending: true,
    });
    expect(result.shown).toBe(true);
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe("sending");
  });
});
