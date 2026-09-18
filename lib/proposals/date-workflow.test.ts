import { describe, expect, it } from "vitest";
import {
  applyCustomerConfirmDate,
  applyCustomerRequestAnotherDate,
  applyTraderConfirmDate,
  applyTraderProvisionalHold,
  bookingConfirmationAfterAccept,
  buildDateWorkflowSnapshot,
  HOLD_SCREEN_COPY,
  isBookedJob,
  needsScheduleJob,
  nextStatusAfterDateResolved,
  readDateSlotState,
} from "@/lib/proposals/date-workflow";

describe("date workflow states", () => {
  it("does not treat a mentioned date as confirmed", () => {
    expect(readDateSlotState(null, "2026-08-12")).toBe("none");
    expect(readDateSlotState(undefined, "2026-08-12")).toBe("none");
  });

  it("lets the trader choose a provisional hold", () => {
    const result = applyTraderProvisionalHold("none");
    expect(result.next).toBe("provisional");
    expect(result.changed).toBe(true);
    expect(result.notifyCustomer).toBe(true);
  });

  it("does not send a second hold request for the same provisional slot", () => {
    const result = applyTraderProvisionalHold("provisional");
    expect(result.changed).toBe(false);
    expect(result.notifyCustomer).toBe(false);
  });

  it("lets the customer confirm a provisional date without accepting the proposal", () => {
    const result = applyCustomerConfirmDate("provisional");
    expect(result.next).toBe("confirmed");
    expect(result.acceptsProposal).toBe(false);
  });

  it("lets the customer request another date and release the hold", () => {
    const result = applyCustomerRequestAnotherDate();
    expect(result.next).toBe("none");
    expect(result.releaseHold).toBe(true);
    expect(result.attentionReason).toBe("customer_requested_date_change");
  });

  it("lets the trader confirm a conversation-agreed date without asking again", () => {
    const result = applyTraderConfirmDate("none");
    expect(result.next).toBe("confirmed");
    expect(result.askCustomerToConfirm).toBe(false);
  });

  it("does not regress a confirmed date back to provisional", () => {
    expect(applyTraderProvisionalHold("confirmed").next).toBe("confirmed");
    expect(bookingConfirmationAfterAccept("confirmed")).toBe("confirmed");
  });

  it("returns an unaccepted confirmed date to Waiting for Customer", () => {
    expect(
      nextStatusAfterDateResolved({
        proposalAccepted: false,
        hasOtherUnresolvedRequests: false,
      })
    ).toBe("waiting_for_customer");
    const snapshot = buildDateWorkflowSnapshot({
      status: "waiting_for_customer",
      bookingConfirmation: "confirmed",
      plannedStartDate: "2026-08-12",
      plannedStartTime: "10:30",
    });
    expect(snapshot.waitingForProposalAcceptance).toBe(true);
    expect(snapshot.isBookedJob).toBe(false);
  });

  it("books the job only when the proposal is accepted and the date is confirmed", () => {
    expect(isBookedJob(true, "confirmed")).toBe(true);
    expect(isBookedJob(false, "confirmed")).toBe(false);
    expect(isBookedJob(true, "provisional")).toBe(false);
    expect(needsScheduleJob(true, "none")).toBe(true);
    expect(needsScheduleJob(true, "confirmed")).toBe(false);
  });

  it("keeps a date-only request out of Needs Attention after it is resolved", () => {
    expect(
      nextStatusAfterDateResolved({
        proposalAccepted: false,
        hasOtherUnresolvedRequests: true,
      })
    ).toBe("needs_attention");
    expect(
      nextStatusAfterDateResolved({
        proposalAccepted: false,
        hasOtherUnresolvedRequests: false,
      })
    ).toBe("waiting_for_customer");
  });

  it("promotes accepted plus confirmed into a booked job from either order", () => {
    const confirmedThenAccepted = buildDateWorkflowSnapshot({
      status: "booked",
      acceptedAt: "2026-08-08T12:00:00.000Z",
      bookingConfirmation: "confirmed",
      plannedStartDate: "2026-08-12",
      plannedStartTime: "10:30",
    });
    expect(confirmedThenAccepted.isBookedJob).toBe(true);

    const acceptedThenConfirmed = buildDateWorkflowSnapshot({
      status: "booked",
      acceptedAt: "2026-08-08T12:00:00.000Z",
      bookingConfirmation: "confirmed",
      plannedStartDate: "2026-08-12",
      plannedStartTime: "10:30",
    });
    expect(acceptedThenConfirmed.isBookedJob).toBe(true);
    expect(needsScheduleJob(true, "none")).toBe(true);
  });

  it("does not treat a completed job as a booked job", () => {
    const completed = buildDateWorkflowSnapshot({
      status: "completed",
      acceptedAt: "2026-09-01T10:00:00.000Z",
      bookingConfirmation: "confirmed",
      plannedStartDate: "2026-09-18",
      plannedStartTime: "09:00",
    });
    expect(completed.isBookedJob).toBe(false);
    expect(completed.needsScheduleJob).toBe(false);
  });

  it("uses a single short hold-screen explanation", () => {
    const text = [
      HOLD_SCREEN_COPY.title,
      HOLD_SCREEN_COPY.note,
      HOLD_SCREEN_COPY.action,
    ].join(" ");
    expect(text).not.toMatch(/does not create a job/i);
    expect(text).not.toMatch(/Saving holds this date/i);
    expect(HOLD_SCREEN_COPY.note.split(" ").length).toBeLessThan(16);
  });
});
