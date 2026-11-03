import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CUSTOMER_NOT_AUTO_NOTIFIED_NOTICE,
  canCancelVisit,
  canRescheduleVisit,
  cancelBlockedReason,
  rescheduleBlockedReason,
} from "@/lib/visits/lifecycle";
import { buildPublicVisitConfirmationView } from "@/lib/visits/customer-confirmation/public-view";
import {
  buildVisitSlotLabel,
  buildVisitStartsAt,
} from "@/lib/visits/customer-confirmation/starts-at";

function readRepo(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("visit reschedule and cancel lifecycle", () => {
  it("allows reschedule and cancel only for scheduled/confirmed visits", () => {
    expect(canRescheduleVisit("scheduled")).toBe(true);
    expect(canRescheduleVisit("confirmed")).toBe(true);
    expect(canRescheduleVisit("completed")).toBe(false);
    expect(canRescheduleVisit("cancelled")).toBe(false);
    expect(canCancelVisit("scheduled")).toBe(true);
    expect(canCancelVisit("completed")).toBe(false);
    expect(rescheduleBlockedReason("completed")).toMatch(/Completed/i);
    expect(cancelBlockedReason("cancelled")).toMatch(/already cancelled/i);
  });

  it("builds consistent datetime fields for reschedule patches", () => {
    expect(buildVisitStartsAt("2026-11-20", "14:30")).toBe(
      "2026-11-20T14:30:00.000Z"
    );
    expect(buildVisitSlotLabel("2026-11-20", "14:30")).toMatch(/2:30/i);
  });

  it("shows cancelled confirmation without private fields", () => {
    const view = buildPublicVisitConfirmationView({
      customer_access_token: "TokenCancelAAAAAAAAAAAAAAAAAAAA",
      visit_type: "initial_assessment",
      visit_date: "2026-11-20",
      visit_time: "10:00",
      slot_label: "20 November 2026 at 10:00",
      status: "cancelled",
      enquiry_summary: "Kitchen",
      address_line_1: "1 High Street",
      address_line_2: "",
      town: "Leeds",
      county: "",
      postcode: "LS1 1AA",
      business_name: "Reanvil Trade",
    });
    expect(view.isCancelled).toBe(true);
    expect(view.statusLabel).toBe("Cancelled");
    expect(view.visitDateTime).toContain("November");
    expect(view).not.toHaveProperty("notes");
  });

  it("wires dedicated actions without auto email and without Stage 2/job schedule changes", () => {
    const actions = readRepo("lib/visits/actions.ts");
    expect(actions).toContain("export async function rescheduleVisitAction");
    expect(actions).toContain("export async function cancelVisitAction");
    expect(actions).toContain("CUSTOMER_NOT_AUTO_NOTIFIED_NOTICE");
    expect(actions).toContain("confirmCancel");
    expect(actions).toContain("customer_access_token: previousToken");

    const rescheduleBlock = actions.slice(
      actions.indexOf("export async function rescheduleVisitAction"),
      actions.indexOf("export async function cancelVisitAction")
    );
    const cancelBlock = actions.slice(
      actions.indexOf("export async function cancelVisitAction"),
      actions.indexOf("export async function updateVisitNotesAction")
    );
    expect(rescheduleBlock).not.toContain("notifyCustomerOfVisit");
    expect(cancelBlock).not.toContain("notifyCustomerOfVisit");

    const detail = readRepo("components/visits/visit-detail-view.tsx");
    expect(detail).toContain("rescheduleVisitAction");
    expect(detail).toContain("cancelVisitAction");
    expect(detail).toContain("Cancel visit");
    expect(detail).toContain("Save new date and time");

    expect(CUSTOMER_NOT_AUTO_NOTIFIED_NOTICE).toMatch(/not emailed automatically/i);

    expect(
      readRepo("lib/proposals/schedule/confirm-schedule-action.ts")
    ).not.toContain("rescheduleVisitAction");
    expect(
      readRepo("lib/proposals/revision/accept-at-revision.ts")
    ).not.toContain("cancelVisitAction");
  });

  it("keeps calendar queries excluding cancelled visits", () => {
    const queries = readRepo("lib/visits/queries.ts");
    expect(queries).toContain('.in("status", ["scheduled", "confirmed", "completed"])');
    expect(queries).not.toContain('"cancelled"');
  });

  it("keeps proposal handoff from visits", () => {
    const actions = readRepo("lib/visits/actions.ts");
    expect(actions).toContain("startQuoteFromVisitAction");
    expect(actions).toContain('quoteParams.set("visitId", visitId)');
    expect(actions).toContain("/proposals/new?");
    expect(actions).toContain("existing.enquiry_id");
  });
});
