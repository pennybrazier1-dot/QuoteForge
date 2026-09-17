import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findMatchingCustomer } from "@/lib/customers/lifecycle";
import {
  findCustomersByTypedName,
  type CustomerNameMatchOption,
} from "@/lib/customers/name-match";
import { MOBILE_FORM_LAYOUT, mobileFormUsesHomeWidth } from "@/lib/layout/mobile-form-layout";
import {
  desktopNewNavigation,
  getMobileNewMenuOption,
  MOBILE_NEW_MENU_OPTIONS,
  MOBILE_NEW_QUOTE_HREF,
  MOBILE_NEW_VISIT_HREF,
} from "@/lib/layout/mobile-new-menu";
import {
  afterVisitCreatedRedirect,
  applyVisitCustomerSuggestion,
  DEFAULT_NEW_VISIT_TYPE,
  getNewVisitTypeOption,
  isNewVisitType,
  NEW_VISIT_PAGE_TITLE,
  NEW_VISIT_TYPE_OPTIONS,
  NEW_VISIT_TYPES,
  planVisitSaveCustomerLink,
  TRADER_HOME_PATH,
  VISIT_CREATED_NOTICE,
  VISIT_CREATED_NOTICE_PARAM,
  VISIT_FORM_SHOWS_SAVED_CUSTOMERS_SELECTOR,
  VISIT_NAME_PLACEHOLDER,
  visitCreateSideEffects,
  visitReasonPlaceholder,
} from "@/lib/visits/new-visit";
import { buildCreateQuoteFromVisitHref } from "@/lib/visits/quote-handoff";
import { formatVisitType, isVisitType, VISIT_TYPES } from "@/lib/visits/types";
import { buildCalendarJobsFromVisits } from "@/lib/visits/calendar";

const sarah: CustomerNameMatchOption = {
  id: "cust-sarah",
  name: "Sarah Jones",
  email: "sarah@example.com",
  phone: "07700 900123",
  address_line_1: "12 High Street",
  town: "Leeds",
  postcode: "LS1 1AA",
};

describe("new visit workflow", () => {
  it("names the page New Visit and defaults to Initial Visit", () => {
    expect(NEW_VISIT_PAGE_TITLE).toBe("New Visit");
    expect(DEFAULT_NEW_VISIT_TYPE).toBe("initial_assessment");
    expect(getNewVisitTypeOption(DEFAULT_NEW_VISIT_TYPE).label).toBe(
      "Initial Visit"
    );
  });

  it("offers exactly Initial Visit, Follow-Up Visit and Final Inspection", () => {
    expect(NEW_VISIT_TYPES).toEqual([
      "initial_assessment",
      "follow_up",
      "final_inspection",
    ]);
    expect(NEW_VISIT_TYPE_OPTIONS.map((option) => option.label)).toEqual([
      "Initial Visit",
      "Follow-Up Visit",
      "Final Inspection",
    ]);
    expect((NEW_VISIT_TYPES as readonly string[]).includes("measure_up")).toBe(
      false
    );
    expect(isNewVisitType("measure_up")).toBe(false);
  });

  it("keeps historical Measure Up readable without offering it for new visits", () => {
    expect(VISIT_TYPES).toContain("measure_up");
    expect(isVisitType("measure_up")).toBe(true);
    expect(formatVisitType("measure_up")).toBe("Measure Up");
    expect(formatVisitType("initial_assessment")).toBe("Initial Visit");
    expect(formatVisitType("follow_up")).toBe("Follow-Up Visit");
    expect(formatVisitType("final_inspection")).toBe("Final Inspection");
  });

  it("explains each visit type and reason placeholder", () => {
    expect(getNewVisitTypeOption("initial_assessment").helper).toMatch(
      /measurements/i
    );
    expect(getNewVisitTypeOption("initial_assessment").helper).toMatch(/quote/i);
    expect(getNewVisitTypeOption("follow_up").helper).toMatch(
      /return|check|discuss/i
    );
    expect(getNewVisitTypeOption("final_inspection").helper).toMatch(
      /completed work|quality|outstanding/i
    );
    expect(visitReasonPlaceholder("initial_assessment")).toMatch(
      /measurements needed/i
    );
    expect(visitReasonPlaceholder("follow_up")).toMatch(
      /check, discuss or measure/i
    );
    expect(visitReasonPlaceholder("final_inspection")).toMatch(
      /signed off/i
    );
  });

  it("starts with a name field and no Saved customers selector", () => {
    expect(VISIT_FORM_SHOWS_SAVED_CUSTOMERS_SELECTOR).toBe(false);
    expect(VISIT_NAME_PLACEHOLDER).toBe("Start typing a name...");
    const form = readFileSync(
      join(process.cwd(), "components/visits/create-visit-form.tsx"),
      "utf8"
    );
    expect(form).not.toMatch(/Saved customer/);
    expect(form).toContain("VISIT_NAME_PLACEHOLDER");
    const page = readFileSync(
      join(process.cwd(), "app/(workspace)/visits/new/page.tsx"),
      "utf8"
    );
    expect(page).toContain("NEW_VISIT_PAGE_TITLE");
  });

  it("accepts a new person's name without linking or activating a customer", () => {
    const plan = planVisitSaveCustomerLink({ selectedCustomerId: null });
    expect(plan.customerId).toBeNull();
    expect(plan.shouldCreateCustomer).toBe(false);
    expect(plan.shouldActivateCustomer).toBe(false);
    expect(plan.matchByName).toBe(false);
  });

  it("suggests an existing customer and keeps their id when selected", () => {
    const matches = findCustomersByTypedName("Sar", [sarah]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe("cust-sarah");

    const applied = applyVisitCustomerSuggestion(sarah);
    expect(applied.customerId).toBe("cust-sarah");
    expect(applied.customerName).toBe("Sarah Jones");
    expect(applied.contactEmail).toBe("sarah@example.com");
    expect(applied.contactPhone).toBe("07700 900123");
    expect(applied.addressLine1).toBe("12 High Street");

    const link = planVisitSaveCustomerLink({
      selectedCustomerId: applied.customerId,
    });
    expect(link.customerId).toBe("cust-sarah");
    expect(link.shouldCreateCustomer).toBe(false);
    expect(link.shouldActivateCustomer).toBe(false);
  });

  it("does not merge two people who only share a name", () => {
    expect(
      findMatchingCustomer(
        [
          {
            id: "cust-other",
            workspace_id: "ws-1",
            name: "Sarah Jones",
            email: "other@example.com",
            phone: "0161 555 0100",
          },
        ],
        {
          workspaceId: "ws-1",
          name: "Sarah Jones",
          email: null,
          phone: null,
        }
      )
    ).toBeNull();
    expect(
      planVisitSaveCustomerLink({ selectedCustomerId: null }).matchByName
    ).toBe(false);
  });

  it("saves a visit only and preserves the chosen type on the calendar as a visit", () => {
    const effects = visitCreateSideEffects();
    expect(effects.createsVisit).toBe(true);
    expect(effects.createsQuote).toBe(false);
    expect(effects.createsProposal).toBe(false);
    expect(effects.createsJob).toBe(false);
    expect(effects.createsInvoice).toBe(false);
    expect(effects.createsActiveCustomer).toBe(false);
    expect(effects.calendarKind).toBe("site_visit");

    const jobs = buildCalendarJobsFromVisits([
      {
        id: "visit-follow",
        workspace_id: "ws-1",
        customer_id: "cust-sarah",
        enquiry_id: null,
        customer_name: "Sarah Jones",
        contact_phone: "",
        contact_email: "",
        address_line_1: "12 High Street",
        address_line_2: "",
        town: "",
        county: "",
        postcode: "",
        enquiry_summary: "",
        visit_type: "follow_up",
        visit_date: "2026-09-24",
        visit_time: "14:00",
        duration_minutes: 60,
        status: "scheduled",
        notes: "",
        linked_proposal_id: null,
        created_at: "2026-09-17T12:00:00.000Z",
        updated_at: "2026-09-17T12:00:00.000Z",
      },
    ]);
    expect(jobs[0]?.kind).toBe("site_visit");
    expect(jobs[0]?.tone).toBe("site_visit");
    expect(jobs[0]?.title).toBe("Follow-Up Visit");
    expect(jobs[0]?.customer).toBe("Sarah Jones");
    expect(jobs[0]?.kind).not.toBe("proposal");
  });

  it("keeps the New Visit form on the Home mobile width", () => {
    expect(mobileFormUsesHomeWidth()).toBe(true);
    expect(MOBILE_FORM_LAYOUT.pagePaddingToken).toBe(
      "var(--page-padding-mobile)"
    );
    expect(MOBILE_FORM_LAYOUT.maxWidth).toBe("100%");
  });

  it("returns every created Visit to Home, including booked-job and enquiry entry points", () => {
    expect(TRADER_HOME_PATH).toBe("/dashboard");
    expect(VISIT_CREATED_NOTICE).toBe("Visit booked");
    expect(afterVisitCreatedRedirect()).toBe(
      `/dashboard?${VISIT_CREATED_NOTICE_PARAM}=1`
    );
    expect(
      afterVisitCreatedRedirect({ visitType: "initial_assessment" })
    ).toBe("/dashboard?visitBooked=1");
    expect(afterVisitCreatedRedirect({ visitType: "follow_up" })).toBe(
      "/dashboard?visitBooked=1"
    );
    expect(afterVisitCreatedRedirect({ visitType: "final_inspection" })).toBe(
      "/dashboard?visitBooked=1"
    );
    expect(
      afterVisitCreatedRedirect({
        visitType: "initial_assessment",
        proposalId: "proposal-1",
        customerId: "cust-1",
      })
    ).toBe("/dashboard?visitBooked=1");
    expect(
      afterVisitCreatedRedirect({
        visitType: "initial_assessment",
        enquiryId: "enquiry-9",
      })
    ).toBe("/dashboard?visitBooked=1");
    expect(
      afterVisitCreatedRedirect({
        visitId: "visit-1",
        proposalId: null,
        enquiryId: null,
      })
    ).toBe("/dashboard?visitBooked=1");
    expect(afterVisitCreatedRedirect()).not.toContain("/proposals/new");
    expect(afterVisitCreatedRedirect()).not.toContain("/visits/");

    const action = readFileSync(
      join(process.cwd(), "lib/visits/actions.ts"),
      "utf8"
    );
    const createFn = action.slice(
      action.indexOf("export async function createVisitAction"),
      action.indexOf("export async function startQuoteFromVisitAction")
    );
    expect(createFn).toContain("afterVisitCreatedRedirect");
    expect(createFn).toContain("linked_proposal_id: resolvedProposalId || null");
    expect(createFn).toContain("customer_id: resolvedCustomerId");
    expect(createFn).toContain("enquiry_id: resolvedEnquiryId || null");
    expect(createFn).not.toContain("redirect(`/visits/${created.id}`)");
    expect(createFn).not.toContain("/proposals/new");
    expect(createFn).not.toContain("startQuoteFromVisitAction");

    const effects = visitCreateSideEffects();
    expect(effects.createsVisit).toBe(true);
    expect(effects.createsQuote).toBe(false);
    expect(effects.createsProposal).toBe(false);
    expect(effects.opensCreateQuote).toBe(false);
    expect(effects.afterCreateRedirect).toBe("/dashboard?visitBooked=1");
  });

  it("keeps explicit Create Quote on visit detail and shows Visit booked on Home", () => {
    expect(buildCreateQuoteFromVisitHref("visit-1")).toBe(
      "/proposals/new?visitId=visit-1"
    );
    const detail = readFileSync(
      join(process.cwd(), "components/visits/visit-detail-view.tsx"),
      "utf8"
    );
    expect(detail).toContain("startQuoteFromVisitAction");
    expect(detail).toContain("Create quote from notes");
    const action = readFileSync(
      join(process.cwd(), "lib/visits/actions.ts"),
      "utf8"
    );
    expect(action).toContain(
      "redirect(`/proposals/new?visitId=${encodeURIComponent(visitId)}`)"
    );
    const home = readFileSync(
      join(process.cwd(), "components/home/home-screen.tsx"),
      "utf8"
    );
    expect(home).toContain("HomeVisitBookedNotice");
    expect(home).toContain("visitBooked");
    const notice = readFileSync(
      join(process.cwd(), "components/home/home-visit-booked-notice.tsx"),
      "utf8"
    );
    expect(notice).toContain("VISIT_CREATED_NOTICE");
    const dashboard = readFileSync(
      join(process.cwd(), "app/(workspace)/dashboard/page.tsx"),
      "utf8"
    );
    expect(dashboard).toContain('visitBooked={visitBooked === "1"}');
    const form = readFileSync(
      join(process.cwd(), "components/visits/create-visit-form.tsx"),
      "utf8"
    );
    expect(form).toContain("createVisitAction");
    expect(form).not.toContain("startQuoteFromVisitAction");
    expect(form).not.toContain("router.push");
    expect(form).not.toContain("router.replace");
  });

  it("keeps desktop Visits available and Quote on the existing route", () => {
    const desktop = desktopNewNavigation();
    expect(desktop.visitsHref).toBe("/visits");
    expect(desktop.newQuoteHref).toBe("/proposals/new");
    expect(MOBILE_NEW_MENU_OPTIONS.map((option) => option.label)).toEqual([
      "Visit",
      "Quote",
    ]);
    expect(getMobileNewMenuOption("visit").href).toBe(MOBILE_NEW_VISIT_HREF);
    expect(getMobileNewMenuOption("quote").href).toBe(MOBILE_NEW_QUOTE_HREF);
  });
});
