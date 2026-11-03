import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCustomerAccessToken } from "@/lib/proposals/customer-portal/create-customer-access-token";
import {
  buildVisitSlotLabel,
  buildVisitStartsAt,
} from "@/lib/visits/customer-confirmation/starts-at";
import {
  assertPublicVisitViewHasNoPrivateFields,
  buildPublicVisitConfirmationView,
} from "@/lib/visits/customer-confirmation/public-view";
import {
  buildCustomerVisitConfirmationPath,
  buildCustomerVisitConfirmationUrl,
} from "@/lib/visits/customer-confirmation/token";

function readRepo(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("visit customer confirmation foundation", () => {
  it("creates long opaque tokens that differ", () => {
    const a = createCustomerAccessToken();
    const b = createCustomerAccessToken();
    expect(a.length).toBe(32);
    expect(a).toMatch(/^[A-Za-z0-9]+$/);
    expect(a).not.toBe(b);
  });

  it("builds /v/{token} paths without node:crypto in the client helper", () => {
    expect(buildCustomerVisitConfirmationPath("TokEn123")).toBe("/v/TokEn123");
    expect(
      buildCustomerVisitConfirmationUrl("TokEn123", "https://app.reanvil.com")
    ).toBe("https://app.reanvil.com/v/TokEn123");

    const tokenHelper = readRepo("lib/visits/customer-confirmation/token.ts");
    expect(tokenHelper).not.toContain("node:crypto");
    expect(tokenHelper).not.toContain("randomBytes");
    expect(tokenHelper).not.toContain("createCustomerAccessToken");
  });

  it("keeps crypto out of the public confirmation page and client-safe modules", () => {
    const page = readRepo("app/v/[token]/page.tsx");
    expect(page).toContain("loadPublicVisitByToken");
    expect(page).not.toContain("localStorage");
    expect(page).not.toContain("useStoredEnquiry");
    expect(page).not.toContain("createCustomerAccessToken");
    expect(page).not.toContain("node:crypto");

    const ui = readRepo("components/visits/customer-visit-confirmation.tsx");
    expect(ui).not.toContain("localStorage");
    expect(ui).not.toContain("createCustomerAccessToken");
  });

  it("mints starts_at and slot labels from date and time", () => {
    expect(buildVisitStartsAt("2026-11-04", "14:30")).toBe(
      "2026-11-04T14:30:00.000Z"
    );
    expect(buildVisitSlotLabel("2026-11-04", "14:30")).toMatch(/2:30\s*pm/i);
  });

  it("builds a public view without private fields", () => {
    const view = buildPublicVisitConfirmationView({
      customer_access_token: "SecureTokenAAAAAAAAAAAAAAAAAAAA",
      visit_type: "initial_assessment",
      visit_date: "2026-11-04",
      visit_time: "10:00",
      slot_label: "4 November 2026 at 10:00",
      status: "scheduled",
      enquiry_summary: "Kitchen measure-up",
      address_line_1: "12 High Street",
      address_line_2: "",
      town: "Leeds",
      county: "",
      postcode: "LS1 1AA",
      business_name: "Carter & Sons",
    });

    expect(view.businessName).toBe("Carter & Sons");
    expect(view.visitDateTime).toBe("4 November 2026 at 10:00");
    expect(view.visitPurpose).toBe("Initial Visit");
    expect(view.address).toContain("12 High Street");
    expect(view.statusLabel).toBe("Scheduled");
    expect(view.isCancelled).toBe(false);
    expect(view.projectSummary).toBe("Kitchen measure-up");
    assertPublicVisitViewHasNoPrivateFields(view);
    expect(view).not.toHaveProperty("notes");
    expect(view).not.toHaveProperty("workspace_id");
    expect(view).not.toHaveProperty("id");
    expect(view).not.toHaveProperty("customer_id");
    expect(view).not.toHaveProperty("contact_email");
  });

  it("marks cancelled and no_show visits for customer display", () => {
    const cancelled = buildPublicVisitConfirmationView({
      customer_access_token: "CancelTokenAAAAAAAAAAAAAAAAAAA",
      visit_type: "initial_assessment",
      visit_date: "2026-11-04",
      visit_time: "10:00",
      slot_label: null,
      status: "cancelled",
      enquiry_summary: "",
      address_line_1: "1 Road",
      address_line_2: "",
      town: "York",
      county: "",
      postcode: "YO1 1AA",
      business_name: "Bright Bathrooms",
    });
    expect(cancelled.isCancelled).toBe(true);
    expect(cancelled.statusLabel).toBe("Cancelled");

    const noShow = buildPublicVisitConfirmationView({
      customer_access_token: "NoShowTokenAAAAAAAAAAAAAAAAAAAA",
      visit_type: "follow_up",
      visit_date: "2026-11-05",
      visit_time: null,
      slot_label: null,
      status: "no_show",
      enquiry_summary: "",
      address_line_1: "",
      address_line_2: "",
      town: "",
      county: "",
      postcode: "",
      business_name: "Bright Bathrooms",
    });
    expect(noShow.isCancelled).toBe(true);
    expect(noShow.statusLabel).toBe("No show");
  });

  it("points notify CTA at /v/{token} and never site root", () => {
    const notify = readRepo("lib/visits/notify.ts");
    expect(notify).toContain("buildCustomerVisitConfirmationUrl");
    expect(notify).not.toContain('`${getSiteUrl()}/`');
    expect(notify).toContain("customer_access_token");
  });

  it("mints a token on visit create", () => {
    const actions = readRepo("lib/visits/actions.ts");
    expect(actions).toContain("createCustomerAccessToken");
    expect(actions).toContain("customer_access_token: token");
    expect(actions).toContain("starts_at: startsAt");
    expect(actions).toContain("slot_label: slotLabel");
  });

  it("does not wire visit confirmation into job schedule paths", () => {
    const confirmSchedule = readRepo(
      "lib/proposals/schedule/confirm-schedule-action.ts"
    );
    expect(confirmSchedule).not.toContain("buildCustomerVisitConfirmation");
    expect(confirmSchedule).not.toContain("/v/");

    const page = readRepo("app/v/[token]/page.tsx");
    expect(page).not.toContain("confirmSchedule");
    expect(page).not.toContain("planned_start");
  });

  it("rejects short or empty tokens at the loader boundary", async () => {
    const { loadPublicVisitByToken } = await import(
      "@/lib/visits/customer-confirmation/load-public-visit"
    );
    const short = await loadPublicVisitByToken("too-short");
    expect(short.ok).toBe(false);
    if (!short.ok) {
      expect(short.error).toMatch(/not valid/i);
    }

    const empty = await loadPublicVisitByToken("   ");
    expect(empty.ok).toBe(false);
  });
});
