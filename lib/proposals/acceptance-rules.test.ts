import { describe, expect, it } from "vitest";
import {
  bookingConfirmationAfterCustomerAccept,
  canShowFinalAccept,
  hasExactStartTime,
  hasExactWorkSchedule,
  isBookedJobFromParts,
  isLongDurationJob,
  revisedProposalRequiresReaccept,
  traderAcceptingRequestedDateBooksJob,
  waitingForCustomerAcceptance,
} from "@/lib/proposals/acceptance-rules";

describe("proposal acceptance rules", () => {
  it("lets the customer Accept proposal when an exact date and time are already set", () => {
    expect(
      canShowFinalAccept({
        canRespond: true,
        plannedStartDate: "2026-10-13",
        plannedStartTime: "13:00",
        estimatedDuration: "1 hour",
      })
    ).toBe(true);
  });

  it("does not show final Accept when only rough timing is set", () => {
    expect(
      hasExactWorkSchedule({
        plannedStartDate: null,
        plannedStartTime: null,
        estimatedDuration: "5 working days",
      })
    ).toBe(false);
    expect(
      canShowFinalAccept({
        canRespond: true,
        plannedStartDate: null,
        plannedStartTime: null,
        estimatedDuration: "5 working days",
      })
    ).toBe(false);
    expect(
      canShowFinalAccept({
        canRespond: true,
        plannedStartDate: null,
        plannedStartTime: null,
        estimatedDuration: null,
      })
    ).toBe(false);
  });

  it("treats a long job with an exact start date as bookable without a clock time", () => {
    expect(isLongDurationJob("5 working days")).toBe(true);
    expect(
      hasExactWorkSchedule({
        plannedStartDate: "2026-10-05",
        plannedStartTime: null,
        estimatedDuration: "5 working days",
      })
    ).toBe(true);
  });

  it("requires a clock time for short appointments", () => {
    expect(isLongDurationJob("1 hour")).toBe(false);
    expect(hasExactStartTime("13:00")).toBe(true);
    expect(
      hasExactWorkSchedule({
        plannedStartDate: "2026-10-13",
        plannedStartTime: null,
        estimatedDuration: "1 hour",
      })
    ).toBe(false);
  });

  it("does not create a Booked Job from a confirmed date alone", () => {
    expect(
      isBookedJobFromParts({
        status: "waiting_for_customer",
        bookingConfirmation: "confirmed",
        plannedStartDate: "2026-08-12",
      })
    ).toBe(false);
    expect(
      waitingForCustomerAcceptance({
        status: "waiting_for_customer",
        bookingConfirmation: "confirmed",
        plannedStartDate: "2026-08-12",
      })
    ).toBe(true);
  });

  it("does not create a Booked Job from an accepted proposal without a confirmed date", () => {
    expect(
      isBookedJobFromParts({
        status: "booked",
        acceptedAt: "2026-08-08T12:00:00.000Z",
        bookingConfirmation: null,
        plannedStartDate: null,
      })
    ).toBe(false);
  });

  it("creates a Booked Job only when the proposal is accepted and the date is confirmed", () => {
    expect(
      isBookedJobFromParts({
        status: "booked",
        acceptedAt: "2026-08-08T12:00:00.000Z",
        bookingConfirmation: "confirmed",
        plannedStartDate: "2026-08-12",
      })
    ).toBe(true);
    expect(bookingConfirmationAfterCustomerAccept(true)).toBe("confirmed");
    expect(bookingConfirmationAfterCustomerAccept(false)).toBe(null);
  });

  it("books the job when the trader accepts the customer's requested available date", () => {
    expect(
      traderAcceptingRequestedDateBooksJob({
        customerRequestedExactSlot: true,
        traderAgrees: true,
        otherProposalDetailsChanged: false,
      })
    ).toBe(true);
    expect(
      traderAcceptingRequestedDateBooksJob({
        customerRequestedExactSlot: true,
        traderAgrees: false,
        otherProposalDetailsChanged: false,
      })
    ).toBe(false);
  });

  it("requires the customer to accept again after a scope or job-detail change", () => {
    expect(revisedProposalRequiresReaccept({ changeKind: "scope" })).toBe(true);
    expect(revisedProposalRequiresReaccept({ changeKind: "price" })).toBe(true);
    expect(revisedProposalRequiresReaccept({ changeKind: "materials" })).toBe(true);
    expect(revisedProposalRequiresReaccept({ changeKind: "date" })).toBe(false);
  });

  it("keeps a Michael-type confirmed date in Waiting for Customer until the proposal is accepted", () => {
    expect(
      waitingForCustomerAcceptance({
        status: "waiting_for_customer",
        acceptedAt: null,
        bookingConfirmation: "confirmed",
        plannedStartDate: "2026-08-12",
      })
    ).toBe(true);
    expect(
      isBookedJobFromParts({
        status: "waiting_for_customer",
        acceptedAt: null,
        bookingConfirmation: "confirmed",
        plannedStartDate: "2026-08-12",
      })
    ).toBe(false);
  });
});
