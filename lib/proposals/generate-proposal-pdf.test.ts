import { describe, expect, it } from "vitest";
import { buildProposalPdfData } from "@/lib/proposals/generate-proposal-pdf";
import { CUSTOMER_FACING_BUSINESS_NAME_FALLBACK } from "@/lib/proposals/pdf/customer-branding";
import { CUSTOMER_CONFIRM_COPY } from "@/lib/proposals/pdf/customer-confirm-copy";

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
    "What we find when we visit",
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

  it("rewrites confirm bullets into customer language and strips material prices", () => {
    const data = buildProposalPdfData(
      {
        ...baseProposal,
        planned_start_date_text: "Next week",
      },
      traderWorkspace
    );

    expect(data.thingsToConfirmBeforeWork).toContain(
      CUSTOMER_CONFIRM_COPY.siteVisit
    );
    expect(data.thingsToConfirmBeforeWork).toContain(
      "Tile colour to be confirmed."
    );
    expect(data.thingsToConfirmBeforeWork.join(" ")).not.toMatch(
      /What we find when we visit/i
    );
    expect(data.materials).toEqual(["Grey tiles", "Adhesive"]);
    expect(data.estimatedPrice).toBe(250000);
    expect(data.optionalExtrasItems).toEqual([]);
  });

  it("hides confirm and optional extras when nothing applies", () => {
    const data = buildProposalPdfData(
      {
        ...baseProposal,
        things_to_confirm_items: [],
        ai_optional_extras: [],
        optional_extras: [],
        planned_start_date_text: "Week commencing 18 August",
        planned_start_date: "2026-08-18",
      },
      traderWorkspace
    );

    expect(data.thingsToConfirmBeforeWork).toEqual([]);
    expect(data.optionalExtrasItems).toEqual([]);
  });

  it("soft-fills start date and materials confirms when still open", () => {
    const data = buildProposalPdfData(
      {
        ...baseProposal,
        materials: [],
        things_to_confirm_items: [],
        ai_optional_extras: [],
        optional_extras: [],
      },
      traderWorkspace
    );

    expect(data.thingsToConfirmBeforeWork).toEqual(
      expect.arrayContaining([
        CUSTOMER_CONFIRM_COPY.materials,
        CUSTOMER_CONFIRM_COPY.startDate,
      ])
    );
  });

  it("keeps true optional extras separate from included work", () => {
    const data = buildProposalPdfData(
      {
        ...baseProposal,
        things_to_confirm_items: [],
        ai_optional_extras: ["Supply and fit a heated towel rail."],
      },
      traderWorkspace
    );

    expect(data.optionalExtrasItems).toEqual([
      "Supply and fit a heated towel rail.",
    ]);
    expect(data.scopeOfWork).not.toContain(
      "Supply and fit a heated towel rail."
    );
  });

  it("does not treat prep-note blocks as optional extras", () => {
    const data = buildProposalPdfData(
      {
        ...baseProposal,
        job_summary: null,
        materials: [],
        things_to_confirm_items: [],
        ai_optional_extras: [],
        optional_extras: [
          "Measurements / dimensions:\n2.1 x 1.8",
          "Materials required:\nGrey tiles",
          "Supply and fit optional heated towel rail.",
        ],
      },
      traderWorkspace
    );

    expect(data.optionalExtrasItems).toEqual([
      "Supply and fit optional heated towel rail.",
    ]);
  });
});
