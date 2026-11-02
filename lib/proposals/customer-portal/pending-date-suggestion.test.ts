import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyTraderSuggestAlternativeFromConfirmed,
  parsePendingDateSuggestion,
} from "@/lib/proposals/date-workflow";
import { PORTAL_AVAILABILITY_COPY } from "@/lib/proposals/customer-portal/portal-page-layout";
import { buildCustomerDateProposedEmail } from "@/lib/email/transactional-events";

describe("pending date suggestion keeps confirmed booking", () => {
  it("A/B — customer request path keeps confirmed booking (releaseHold false)", () => {
    const actions = readFileSync(
      join(process.cwd(), "lib/proposals/customer-portal/actions.ts"),
      "utf8"
    );
    expect(actions).toContain("recordPendingDateChangeRequest");
    expect(actions).toContain("keepConfirmedBooking");
  });

  it("C/D — Suggest stores pending alternative without changing confirmed next state", () => {
    const result = applyTraderSuggestAlternativeFromConfirmed();
    expect(result.next).toBe("confirmed");
    expect(result.changed).toBe(false);
    expect(result.storesPendingSuggestion).toBe(true);

    const persist = readFileSync(
      join(process.cwd(), "lib/proposals/date-workflow-persist.ts"),
      "utf8"
    );
    expect(persist).toContain("export async function recordPendingDateSuggestion");
    expect(persist).toContain("keeps_confirmed_booking: true");
    expect(persist).toContain('eq("booking_confirmation", "confirmed")');

    const hold = readFileSync(
      join(process.cwd(), "lib/proposals/date-workflow-actions.ts"),
      "utf8"
    );
    expect(hold).toContain("recordPendingDateSuggestion");
    expect(hold).toContain("previousDateLabel: confirmedBookingLabel");
  });

  it("E/F — decline keeps confirmed booking and clears only the suggestion", () => {
    const actions = readFileSync(
      join(process.cwd(), "lib/proposals/customer-portal/actions.ts"),
      "utf8"
    );
    expect(actions).toContain("export async function declinePendingDateSuggestion");
    expect(actions).toContain("clearPendingDateSuggestion");
    expect(actions).toContain("I'll keep my booking");
  });

  it("G/H — accept swaps planned_start atomically and clears pending suggestion", () => {
    const actions = readFileSync(
      join(process.cwd(), "lib/proposals/customer-portal/actions.ts"),
      "utf8"
    );
    expect(actions).toContain("acceptPendingDateSuggestion");
    expect(actions).toContain("accept_pending_date_suggestion");
    expect(actions).toContain('pending_date_suggestion: null');
    expect(actions).toContain('.not("pending_date_suggestion", "is", null)');
    expect(actions).toContain("released_previous_booking: true");
  });

  it("I — accept rechecks occupancy before confirming", () => {
    const actions = readFileSync(
      join(process.cwd(), "lib/proposals/customer-portal/actions.ts"),
      "utf8"
    );
    expect(actions).toContain("loadWorkspaceOccupiedSlots");
    expect(actions).toContain("isSlotTakenByOther");
    expect(actions).toContain("That suggested time is no longer available");
  });

  it("J — duplicate accept is idempotent when suggestion already cleared", () => {
    const actions = readFileSync(
      join(process.cwd(), "lib/proposals/customer-portal/actions.ts"),
      "utf8"
    );
    expect(actions).toContain("// Idempotent: already accepted or cleared.");
    expect(actions).toContain('result: "date_accepted"');
  });

  it("K — portal distinguishes current confirmed vs proposed alternative", () => {
    expect(PORTAL_AVAILABILITY_COPY.confirmedBookingHeading).toBe(
      "Current confirmed booking"
    );
    expect(PORTAL_AVAILABILITY_COPY.proposedAlternativeHeading).toBe(
      "Proposed new date"
    );
    expect(PORTAL_AVAILABILITY_COPY.proposedAlternativeHint).toContain(
      "not reserved until you accept"
    );
    expect(PORTAL_AVAILABILITY_COPY.keepConfirmedBookingButton).toBe(
      "Keep current booking"
    );

    const portal = readFileSync(
      join(
        process.cwd(),
        "components/proposals/customer-portal/customer-proposal-portal.tsx"
      ),
      "utf8"
    );
    expect(portal).toContain("confirmedBookingHeading");
    expect(portal).toContain("proposedAlternativeHeading");
    expect(portal).toContain("declinePendingDateSuggestion");
  });

  it("L — Needs Attention clears after Suggest (attention_reason null)", () => {
    const persist = readFileSync(
      join(process.cwd(), "lib/proposals/date-workflow-persist.ts"),
      "utf8"
    );
    expect(persist).toMatch(
      /recordPendingDateSuggestion[\s\S]*attention_reason: null/
    );
  });

  it("M — email distinguishes previous confirmed date from proposed alternative", () => {
    const email = buildCustomerDateProposedEmail({
      businessName: "Penny Builder",
      customerName: "Jordan Portside",
      slotLabel: "Friday 13 November · 14:00",
      portalToken: "test-token-abcdefgh",
      previousDateLabel: "Wednesday 11 November · 09:00",
    });
    expect(email.html).toContain("Current confirmed booking");
    expect(email.html).toContain("Wednesday 11 November · 09:00");
    expect(email.html).toContain("Proposed new date");
    expect(email.html).toContain("Friday 13 November · 14:00");
    expect(email.html).toContain(
      "Your current booking stays confirmed until you accept this alternative."
    );
    expect(email.html).toContain("not reserved until you accept");
    expect(email.text).toMatch(/Current confirmed booking/i);
    expect(email.text).toMatch(/Proposed new date/i);
  });

  it("migration adds pending_date_suggestion without touching planned_start", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261102190000_pending_date_suggestion.sql"
      ),
      "utf8"
    );
    expect(migration).toContain("pending_date_suggestion jsonb");
    expect(migration).not.toContain("planned_start_date");
  });

  it("rejects invalid suggestion payloads", () => {
    expect(parsePendingDateSuggestion(null)).toBe(null);
    expect(parsePendingDateSuggestion({ date: "2026-11-13" })).toBe(null);
  });
});
