import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildBookVisitFromEnquiryHref } from "@/lib/enquiries/book-visit-handoff";
import { buildBookVisitHref } from "@/lib/jobs/prep-checklist";
import { MOBILE_NEW_VISIT_HREF } from "@/lib/layout/mobile-new-menu";
import { buildCustomerVisitConfirmationPath } from "@/lib/visits/customer-confirmation/token";
import { NEW_VISIT_TYPES } from "@/lib/visits/new-visit";

function readRepo(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("unified visits milestone 2", () => {
  it("routes every booking entry point through /visits/new", () => {
    expect(buildBookVisitFromEnquiryHref("enq-1")).toBe(
      "/visits/new?enquiryId=enq-1"
    );
    expect(MOBILE_NEW_VISIT_HREF).toBe("/visits/new");
    expect(
      buildBookVisitHref({
        proposalId: "p1",
        customerId: "c1",
        enquiryId: "e1",
        visitType: "initial_assessment",
      })
    ).toContain("/visits/new?");

    const card = readRepo("components/enquiries/enquiry-card.tsx");
    expect(card).toContain("buildBookVisitFromEnquiryHref");
    expect(card).not.toContain("BookSiteVisitDialog");
    expect(card).not.toContain("bookSiteVisitAction");

    const detail = readRepo("components/enquiries/enquiry-detail-view.tsx");
    expect(detail).toContain("buildBookVisitFromEnquiryHref");

    const calendar = readRepo("components/calendar/calendar-screen.tsx");
    expect(calendar).toContain('href="/visits/new"');

    const visitsPage = readRepo("app/(workspace)/visits/page.tsx");
    expect(visitsPage).toContain('href="/visits/new"');

    const customers = readRepo(
      "components/customers/customer-lifecycle-actions.tsx"
    );
    expect(customers).toContain("/visits/new?customerId=");
  });

  it("retires the old site_visits booking write path", () => {
    const actions = readRepo("lib/enquiries/server/actions.ts");
    expect(actions).toContain("Site visits are booked from Visits now");
    const bookStart = actions.indexOf("export async function bookSiteVisitAction");
    expect(bookStart).toBeGreaterThanOrEqual(0);
    const bookBlock = actions.slice(
      bookStart,
      actions.indexOf("export async function", bookStart + 1)
    );
    expect(bookBlock).not.toContain(".upsert(");
    expect(bookBlock).not.toContain(".insert(");

    const create = readRepo("lib/visits/actions.ts");
    expect(create).toContain("linkCaptureSessionToVisit");
    expect(create).toContain("customer_access_token: token");
    expect(create).toContain("Could not create a separate capture session");
    expect(create).toContain(".delete()");
    expect(create).toContain('eq("id", created.id)');
  });

  it("preserves follow-up and final inspection types without forcing initial only", () => {
    expect(NEW_VISIT_TYPES).toContain("initial_assessment");
    expect(NEW_VISIT_TYPES).toContain("follow_up");
    expect(NEW_VISIT_TYPES).toContain("final_inspection");
    expect(NEW_VISIT_TYPES).not.toContain("measure_up");
  });

  it("links Site Visit Mode capture via visit_id without creating a second booking", () => {
    const ensure = readRepo("lib/enquiries/server/actions.ts");
    expect(ensure).toContain("findActiveVisitForEnquiry");
    expect(ensure).toContain("linkCaptureSessionToVisit");
    expect(ensure).toContain(
      "Compatibility: historical enquiry with no visits booking yet"
    );

    const link = readRepo("lib/visits/link-capture-session.ts");
    expect(link).toContain("Does not create a second booking");
    expect(link).toContain("visit_id: input.visitId");
  });

  it("shows secure /v/{token} confirmation to traders", () => {
    expect(buildCustomerVisitConfirmationPath("Abc123")).toBe("/v/Abc123");

    const panel = readRepo("components/enquiries/customer-job-link-panel.tsx");
    expect(panel).toContain("getEnquiryVisitConfirmationAction");
    expect(panel).not.toContain("buildCustomerJobUrl");
    expect(panel).toContain("secure page");

    const detail = readRepo("components/visits/visit-detail-view.tsx");
    expect(detail).toContain("buildCustomerVisitConfirmationUrl");
    expect(detail).toContain("Open Site Visit Mode");

    const notify = readRepo("lib/visits/notify.ts");
    expect(notify).toContain("buildCustomerVisitConfirmationUrl");
  });

  it("keeps orphan site_visits on calendar only when visit_id is null", () => {
    const actions = readRepo("lib/enquiries/server/actions.ts");
    expect(actions).toContain('.is("visit_id", null)');
    expect(actions).toContain("Only orphan capture rows");
  });

  it("does not change Stage 2 acceptance or job scheduling modules", () => {
    expect(
      readRepo("lib/proposals/revision/accept-at-revision.ts")
    ).not.toContain("linkCaptureSessionToVisit");
    expect(
      readRepo("lib/proposals/schedule/confirm-schedule-action.ts")
    ).not.toContain("linkCaptureSessionToVisit");
    expect(
      readRepo("lib/proposals/schedule/confirm-schedule-action.ts")
    ).not.toContain("buildCustomerVisitConfirmation");
  });

  it("keeps proposal handoff from visits", () => {
    const actions = readRepo("lib/visits/actions.ts");
    expect(actions).toContain("startQuoteFromVisitAction");
    expect(actions).toContain('quoteParams.set("visitId", visitId)');
    expect(actions).toContain("/proposals/new?");
  });
});
