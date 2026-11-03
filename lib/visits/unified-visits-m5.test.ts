import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSiteVisitModePath } from "@/lib/enquiries/site-visit-mode-link";
import { NEW_VISIT_TYPES } from "@/lib/visits/new-visit";
import { VISIT_TYPES } from "@/lib/visits/types";

function readRepo(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("unified visits milestone 5 — capture per visit + UK time", () => {
  it("adds an additive migration after the visit backfill set", () => {
    const migration = readRepo(
      "supabase/migrations/20261104030000_site_visits_capture_per_visit.sql"
    );
    expect(migration).toContain("drop constraint if exists site_visits_enquiry_id_key");
    expect(migration).toContain("site_visits_visit_id_uidx");
    expect(migration).toContain("site_visits_historical_review");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.site_visits_historical_review from anon");
    expect(migration).toContain(
      "revoke all on table public.site_visits_historical_review from authenticated"
    );
    expect(migration).not.toMatch(/delete from public\.site_visits/i);
    expect(migration).not.toMatch(/drop table public\.site_visits/i);

    // Stage 2 migrations remain untouched.
    expect(
      readRepo("supabase/migrations/20261103010000_proposal_revisions.sql").length
    ).toBeGreaterThan(100);
  });

  it("links capture by visit_id and never reuses enquiry-level capture blindly", () => {
    const link = readRepo("lib/visits/link-capture-session.ts");
    expect(link).toContain("eq(\"visit_id\", input.visitId)");
    expect(link).toContain("Do not attach historical enquiry-level captures");
    expect(link).toContain("visit_id: input.visitId");

    const ensure = readRepo("lib/enquiries/server/actions.ts");
    expect(ensure).toContain("visitId?: string | null");
    expect(ensure).toContain("Visit not found for this enquiry");
    expect(ensure).toContain("loadPrimarySiteVisitForEnquiry");
    expect(readRepo("lib/enquiries/server/load-enquiry-site-visit.ts")).toContain(
      "findActiveVisitForEnquiry"
    );
  });

  it("opens Site Visit Mode for the selected visit", () => {
    expect(buildSiteVisitModePath("enq-1", "visit-2")).toBe(
      "/site-visit/enq-1?visitId=visit-2"
    );
    expect(readRepo("components/visits/visit-detail-view.tsx")).toContain(
      "buildSiteVisitModePath(visit.enquiry_id, visit.id)"
    );
    expect(readRepo("app/site-visit/[enquiryId]/page.tsx")).toContain("visitId");
    expect(readRepo("lib/site-visit/use-workspace-site-visit.ts")).toContain(
      "ensureSiteVisitAction(enquiryId, visitId)"
    );
  });

  it("lists all visits on the enquiry and preserves proposal handoff", () => {
    expect(readRepo("components/enquiries/enquiry-detail-view.tsx")).toContain(
      "EnquiryVisitsPanel"
    );
    expect(readRepo("components/enquiries/enquiry-visits-panel.tsx")).toContain(
      "Site Visit Mode"
    );
    expect(readRepo("lib/visits/actions.ts")).toContain("startQuoteFromVisitAction");
    expect(readRepo("lib/visits/actions.ts")).toContain('quoteParams.set("visitId", visitId)');
    expect(readRepo("lib/visits/actions.ts")).toContain("/proposals/new?");
  });

  it("supports multiple visit kinds against one enquiry", () => {
    expect(NEW_VISIT_TYPES).toContain("initial_assessment");
    expect(NEW_VISIT_TYPES).toContain("follow_up");
    expect(VISIT_TYPES).toContain("measure_up");
    expect(VISIT_TYPES).toContain("final_inspection");
  });

  it("interprets appointment starts_at in Europe/London", () => {
    const starts = readRepo("lib/visits/customer-confirmation/starts-at.ts");
    expect(starts).toContain("resolveLondonLocalDateTime");
    expect(starts).toContain("resolveVisitStartsAt");
    expect(starts).not.toContain("T${hhmm}:00.000Z");
    expect(readRepo("lib/visits/business-timezone.ts")).toContain("Europe/London");
  });

  it("keeps Home/calendar/customer confirmation on visit_date + visit_time wall labels", () => {
    expect(readRepo("lib/home/home-lifecycle.ts")).toContain("visit.visit_date");
    expect(readRepo("lib/visits/calendar.ts")).toContain("visit.visit_date");
    expect(readRepo("lib/email/transactional-events.ts")).toContain(
      "formatProposalEmailTime(input.visit.visit_time)"
    );
    expect(readRepo("lib/visits/customer-confirmation/public-view.ts")).toContain(
      "buildVisitSlotLabel(source.visit_date, source.visit_time)"
    );
  });

  it("does not change Stage 2 acceptance or job scheduling modules", () => {
    expect(
      readRepo("lib/proposals/revision/accept-at-revision.ts")
    ).not.toContain("linkCaptureSessionToVisit");
    expect(
      readRepo("lib/proposals/schedule/confirm-schedule-action.ts")
    ).not.toContain("londonLocalDateTimeToUtcIso");
  });
});
