import {
  buildDefaultPrepItemRows,
  resolveInitialPrepStatus,
  type ProposalJobSeed,
} from "@/lib/jobs/create-job-from-proposal";
import { buildJobPrepActionHref } from "@/lib/jobs/prep-items";
import { describe, expect, it } from "vitest";

const baseProposal: ProposalJobSeed = {
  id: "proposal-1",
  workspace_id: "workspace-1",
  customer_id: "customer-1",
  customer_name: "Alex Customer",
  customer_email: "alex@example.com",
  customer_phone: "07123456789",
  customer_address: "12 High Street",
  job_address: null,
  planned_start_date: null,
  materials: ["Timber", "Fixings"],
};

describe("resolveInitialPrepStatus", () => {
  it("confirms customer details when name, contact, and address exist", () => {
    expect(resolveInitialPrepStatus("customer_details", baseProposal)).toBe(
      "confirmed"
    );
  });

  it("leaves customer details open when contact is missing", () => {
    expect(
      resolveInitialPrepStatus("customer_details", {
        ...baseProposal,
        customer_email: null,
        customer_phone: null,
      })
    ).toBe("open");
  });

  it("keeps measurements and site visit open by default", () => {
    expect(resolveInitialPrepStatus("measurements", baseProposal)).toBe("open");
    expect(resolveInitialPrepStatus("site_visit", baseProposal)).toBe("open");
  });
});

describe("buildDefaultPrepItemRows", () => {
  it("creates all six preparation items in stable order", () => {
    const rows = buildDefaultPrepItemRows(
      "workspace-1",
      "job-1",
      baseProposal,
      "2026-08-07T12:00:00.000Z"
    );

    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.item_key)).toEqual([
      "customer_details",
      "measurements",
      "site_visit",
      "materials",
      "access_requirements",
      "start_date",
    ]);
    expect(rows[0]?.status).toBe("confirmed");
    expect(rows[0]?.confirmed_at).toBe("2026-08-07T12:00:00.000Z");
    expect(rows[1]?.status).toBe("open");
  });
});

describe("buildJobPrepActionHref", () => {
  it("routes start date into the existing booking confirm flow", () => {
    expect(
      buildJobPrepActionHref("start_date", {
        proposalId: "proposal-1",
        customerId: "customer-1",
        enquiryId: null,
      })
    ).toBe("/proposals/proposal-1?confirmBooking=1");
  });

  it("routes site visit prep to the linked enquiry when available", () => {
    expect(
      buildJobPrepActionHref("site_visit", {
        proposalId: "proposal-1",
        customerId: null,
        enquiryId: "enquiry-9",
      })
    ).toBe("/enquiries/enquiry-9");
  });
});
