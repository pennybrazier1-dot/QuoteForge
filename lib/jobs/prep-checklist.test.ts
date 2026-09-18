import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOOKED_JOB_PREP_KEYS,
  buildBookVisitHref,
  buildPrepChecklistRows,
  defaultVisitTypeFromHistory,
  pickRelevantVisit,
  visitBelongsToJob,
} from "@/lib/jobs/prep-checklist";
import { visitCreateSideEffects } from "@/lib/visits/new-visit";
import { TRADER_MOBILE_PAGE_CLASS } from "@/lib/layout/trader-mobile-page";
import type { VisitRecord } from "@/lib/visits/types";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function visit(overrides: Partial<VisitRecord> = {}): VisitRecord {
  return {
    id: "visit-1",
    workspace_id: "ws-1",
    customer_id: "cust-1",
    enquiry_id: null,
    customer_name: "Jessica Walker",
    contact_phone: "",
    contact_email: "",
    address_line_1: "",
    address_line_2: "",
    town: "",
    county: "",
    postcode: "",
    enquiry_summary: "",
    visit_type: "initial_assessment",
    visit_date: "2026-09-25",
    visit_time: "10:00",
    duration_minutes: 60,
    status: "scheduled",
    notes: "",
    linked_proposal_id: "proposal-1",
    created_at: "2026-09-17T10:00:00.000Z",
    updated_at: "2026-09-17T10:00:00.000Z",
    ...overrides,
  };
}

const items = [
  { id: "i-customer", item_key: "customer_details" as const, status: "confirmed" as const },
  { id: "i-measure", item_key: "measurements" as const, status: "confirmed" as const },
  { id: "i-visit", item_key: "site_visit" as const, status: "open" as const },
  { id: "i-materials", item_key: "materials" as const, status: "open" as const },
  { id: "i-access", item_key: "access_requirements" as const, status: "confirmed" as const },
  { id: "i-start", item_key: "start_date" as const, status: "open" as const },
];

describe("booked-job preparation checklist", () => {
  it("uses checklist-style statuses from stored prep items", () => {
    const rows = buildPrepChecklistRows({ items, linkedVisit: null });
    expect(rows.map((row) => row.key)).toEqual([...BOOKED_JOB_PREP_KEYS]);
    expect(rows.find((row) => row.key === "customer_details")).toMatchObject({
      statusLabel: "Confirmed",
      tone: "done",
    });
    expect(rows.find((row) => row.key === "measurements")).toMatchObject({
      statusLabel: "Confirmed",
      tone: "done",
    });
    expect(rows.find((row) => row.key === "materials")).toMatchObject({
      statusLabel: "Needs confirming",
      tone: "open",
    });
    expect(rows.find((row) => row.key === "access_requirements")).toMatchObject({
      statusLabel: "Confirmed",
      tone: "done",
    });
    expect(rows.find((row) => row.key === "site_visit")).toMatchObject({
      label: "Site visit",
      statusLabel: "Not booked",
      tone: "open",
    });
    expect(BOOKED_JOB_PREP_KEYS).not.toContain("start_date");
  });

  it("keeps measurements on stored evidence and does not invent completion", () => {
    const openMeasure = buildPrepChecklistRows({
      items: items.map((item) =>
        item.item_key === "measurements" ? { ...item, status: "open" } : item
      ),
      linkedVisit: visit({
        status: "completed",
        notes: "Took sizes on site.",
      }),
    });
    expect(openMeasure.find((row) => row.key === "measurements")?.statusLabel).toBe(
      "Needs confirming"
    );
    expect(openMeasure.find((row) => row.key === "measurements")?.tone).toBe(
      "open"
    );
  });

  it("shows Book visit for an unbooked site visit and View visit when linked", () => {
    const unbooked = buildPrepChecklistRows({ items, linkedVisit: null });
    expect(unbooked.find((row) => row.key === "site_visit")?.statusLabel).toBe(
      "Not booked"
    );
    const href = buildBookVisitHref({
      proposalId: "proposal-1",
      customerId: "cust-1",
      enquiryId: "enquiry-9",
      visitType: "initial_assessment",
    });
    expect(href).toBe(
      "/visits/new?proposalId=proposal-1&customerId=cust-1&enquiryId=enquiry-9&visitType=initial_assessment"
    );

    const booked = buildPrepChecklistRows({
      items,
      linkedVisit: visit(),
    });
    const siteVisit = booked.find((row) => row.key === "site_visit");
    expect(siteVisit?.statusLabel).toBe("Booked");
    expect(siteVisit?.detail).toContain("25 September");
    expect(siteVisit?.detail).toContain("10:00");
    expect(siteVisit?.showMoreMenu).toBe(false);
  });

  it("defaults visit type from real visit history and keeps trader choice", () => {
    expect(defaultVisitTypeFromHistory([])).toBe("initial_assessment");
    expect(
      defaultVisitTypeFromHistory([
        visit({ visit_type: "initial_assessment", status: "completed" }),
      ])
    ).toBe("follow_up");
    expect(
      defaultVisitTypeFromHistory([
        visit({ visit_type: "initial_assessment", status: "cancelled" }),
      ])
    ).toBe("initial_assessment");
    const form = readRepo("components/visits/create-visit-form.tsx");
    expect(form).toContain("NEW_VISIT_TYPE_OPTIONS.map");
    expect(form).toContain("setVisitType");
    expect(form).toContain("defaultVisitType");
  });

  it("preserves not-needed without cluttering the main row", () => {
    const rows = buildPrepChecklistRows({
      items: items.map((item) =>
        item.item_key === "materials"
          ? { ...item, status: "not_needed" }
          : item
      ),
      linkedVisit: null,
    });
    const materials = rows.find((row) => row.key === "materials");
    expect(materials?.statusLabel).toBe("Not needed");
    expect(materials?.tone).toBe("skip");
    expect(materials?.showMoreMenu).toBe(false);
    expect(rows.find((row) => row.key === "site_visit")?.showMoreMenu).toBe(true);
    const panel = readRepo("components/proposals/job-preparation-panel.tsx");
    expect(panel).toContain("Mark not needed");
    expect(panel).toContain("qf-job-prep-more");
    expect(panel).not.toContain("Schedule visit");
    expect(panel).not.toContain("Confirm materials");
    expect(panel).not.toContain("Confirm access");
  });

  it("links visits to the current customer/job and only creates a visit", () => {
    expect(
      visitBelongsToJob(visit(), {
        proposalId: "proposal-1",
        enquiryId: null,
        customerId: "cust-1",
      })
    ).toBe(true);
    expect(
      visitBelongsToJob(visit({ linked_proposal_id: "other-job" }), {
        proposalId: "proposal-1",
        enquiryId: null,
        customerId: "cust-1",
      })
    ).toBe(false);
    expect(
      visitBelongsToJob(visit({ linked_proposal_id: null }), {
        proposalId: "proposal-1",
        enquiryId: null,
        customerId: "cust-1",
      })
    ).toBe(true);
    expect(pickRelevantVisit([visit({ visit_date: "2026-09-20" }), visit({
      id: "visit-2",
      visit_date: "2026-09-30",
    })], new Date("2026-09-24T12:00:00.000Z"))?.id).toBe("visit-2");
    expect(visitCreateSideEffects()).toMatchObject({
      createsVisit: true,
      createsQuote: false,
      createsProposal: false,
      createsJob: false,
      createsActiveCustomer: false,
    });
    const action = readRepo("lib/visits/actions.ts");
    expect(action).toContain("linked_proposal_id: resolvedProposalId || null");
    expect(action).toContain('from("visits")');
    expect(action).not.toContain("ensureActiveCustomer");
  });

  it("keeps the checklist on the shared mobile card width and one model", () => {
    const workspace = readRepo("components/proposals/proposal-workspace.tsx");
    const panel = readRepo("components/proposals/job-preparation-panel.tsx");
    expect(workspace).toContain(TRADER_MOBILE_PAGE_CLASS);
    expect(workspace).toContain("qf-job-prep-card");
    expect(workspace).toContain("<JobPreparationPanel");
    expect(panel).toContain("buildPrepChecklistRows");
    expect(panel).toContain("Book visit");
    expect(panel).toContain("View visit");
    expect(panel).toContain("/visits/${visitSummary.id}");
    expect(readRepo("app/(workspace)/visits/new/page.tsx")).toContain(
      "proposalId"
    );
    expect(readRepo("app/(workspace)/visits/new/page.tsx")).toContain(
      "defaultVisitType"
    );
  });
});
