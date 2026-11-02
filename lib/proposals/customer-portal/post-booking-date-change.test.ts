import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyCustomerRequestAnotherDate } from "@/lib/proposals/date-workflow";
import { hasPendingBookedDateChange } from "@/lib/home/home-lifecycle";
import { PORTAL_AVAILABILITY_COPY } from "@/lib/proposals/customer-portal/portal-page-layout";

describe("post-booking date change requests", () => {
  it("does not release a confirmed booking when the customer asks to change it", () => {
    const result = applyCustomerRequestAnotherDate({
      keepConfirmedBooking: true,
    });
    expect(result.releaseHold).toBe(false);
    expect(result.next).toBe("confirmed");
  });

  it("flags a booked confirmed job with a pending date-change attention reason", () => {
    expect(
      hasPendingBookedDateChange({
        id: "p1",
        status: "booked",
        attention_reason: "customer_requested_date_change",
        booking_confirmation: "confirmed",
        accepted_at: "2026-11-02T18:00:00.000Z",
        planned_start_date: "2026-11-11",
        planned_start_date_text: "11 November 2026",
        planned_start_time: "09:00",
      })
    ).toBe(true);

    expect(
      hasPendingBookedDateChange({
        id: "p2",
        status: "booked",
        attention_reason: null,
        booking_confirmation: "confirmed",
        accepted_at: "2026-11-02T18:00:00.000Z",
        planned_start_date: "2026-11-11",
        planned_start_date_text: null,
        planned_start_time: "09:00",
      })
    ).toBe(false);
  });

  it("shows a clear customer confirmation that the booking stays put", () => {
    expect(PORTAL_AVAILABILITY_COPY.bookedChangePendingCopy).toBe(
      "Your change request has been sent to your builder. Your existing booking remains confirmed until a new date or time is agreed."
    );
  });

  it("wires the portal action to keep booked requests without releasing the hold", () => {
    const actions = readFileSync(
      join(process.cwd(), "lib/proposals/customer-portal/actions.ts"),
      "utf8"
    );
    expect(actions).toContain("recordPendingDateChangeRequest");
    expect(actions).toContain("keepConfirmedBooking");
    expect(actions).toContain("canRequestScheduleChange");
  });

  it("records pending requests without clearing planned_start fields", () => {
    const persist = readFileSync(
      join(process.cwd(), "lib/proposals/date-workflow-persist.ts"),
      "utf8"
    );
    expect(persist).toContain("export async function recordPendingDateChangeRequest");
    expect(persist).toContain("keeps_confirmed_booking: true");
    expect(persist).toMatch(
      /recordPendingDateChangeRequest[\s\S]*attention_reason: input\.attentionReason/
    );
    expect(persist).not.toMatch(
      /recordPendingDateChangeRequest[\s\S]*planned_start_date: null/
    );
  });

  it("does not overwrite confirmed booking when Suggest is used on a booked job", () => {
    const hold = readFileSync(
      join(process.cwd(), "lib/proposals/date-workflow-actions.ts"),
      "utf8"
    );
    expect(hold).toContain("recordPendingDateSuggestion");
    // Booked Suggest path must not call persistProposalDateSlot for that branch
    const bookedBranch = hold.slice(
      hold.indexOf("if (pendingBookedDateChange)"),
      hold.indexOf("const transition = applyTraderProvisionalHold")
    );
    expect(bookedBranch).toContain("recordPendingDateSuggestion");
    expect(bookedBranch).not.toContain("persistProposalDateSlot");
  });
});
