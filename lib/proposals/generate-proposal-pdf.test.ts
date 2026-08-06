import { describe, expect, it } from "vitest";
import { buildProposalPdfData } from "@/lib/proposals/generate-proposal-pdf";
import { CUSTOMER_FACING_BUSINESS_NAME_FALLBACK } from "@/lib/proposals/pdf/customer-branding";
import { CUSTOMER_NEXT_STEP } from "@/lib/proposals/pdf/customer-next-steps";

const baseProposal = {
  proposal_number: "PROP-1",
  created_at: "2026-08-06T12:00:00.000Z",
  customer_name: "Alex Customer",
  customer_address: "1 High Street",
  customer_email: "alex@example.com",
  customer_phone: "07000 000000",
  rough_notes: "Bathroom refit",
  optional_extras: null,
  things_to_confirm: null,
  estimated_duration: "2 days",
  payment_terms: "50% deposit",
  total_amount: 250000,
  job_summary: "Refit the family bathroom.",
  scope_of_work: "Remove suite\nFit new suite",
  materials: ["Grey tiles — £120.00", "Adhesive"],
  labour_description: "Supply and fit labour.",
  ai_optional_extras: [],
  things_to_confirm_items: [
    CUSTOMER_NEXT_STEP.measurements,
    "Confirm tile colour",
  ],
};

const traderWorkspace = {
  business_name: "Bright Bathrooms Ltd",
  trade_type: "Bathroom Fitting",
  contact_email: "hello@bright.example",
  phone: "01234 567890",
  default_payment_terms: "Due on completion",
};

describe("buildProposalPdfData", () => {
  it("uses trader business identity and never admin branding", () => {
    const data = buildProposalPdfData(baseProposal, {
      ...traderWorkspace,
      business_name: "Reanvil Admin Testing",
    });

    expect(data.businessName).toBe(CUSTOMER_FACING_BUSINESS_NAME_FALLBACK);
  });

  it("moves readiness phrases into next steps and strips material line prices", () => {
    const data = buildProposalPdfData(baseProposal, traderWorkspace);

    expect(data.nextSteps).toContain(CUSTOMER_NEXT_STEP.measurements);
    expect(data.nextSteps).toContain(CUSTOMER_NEXT_STEP.siteVisit);
    expect(data.thingsToConfirm).toEqual(["Confirm tile colour"]);
    expect(data.materials).toEqual(["Grey tiles", "Adhesive"]);
    expect(data.estimatedPrice).toBe(250000);
    expect(JSON.stringify(data)).not.toMatch(/£120/);
  });

  it("strips legacy readiness blurbs from optional extras", () => {
    const data = buildProposalPdfData(
      {
        ...baseProposal,
        job_summary: null,
        materials: [],
        things_to_confirm_items: [],
        ai_optional_extras: [],
        optional_extras: [
          "Still to confirm later: Materials to confirm; Start date to confirm.",
          "Consider booking a site visit to confirm measurements.",
        ],
      },
      traderWorkspace
    );

    expect(data.nextSteps).toEqual(
      expect.arrayContaining([
        CUSTOMER_NEXT_STEP.materials,
        CUSTOMER_NEXT_STEP.startDate,
        CUSTOMER_NEXT_STEP.siteVisit,
      ])
    );
    expect(data.optionalExtras).not.toContain("Still to confirm later");
    expect(data.optionalExtras).not.toContain("site visit");
  });
});
