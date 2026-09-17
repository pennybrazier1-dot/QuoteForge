import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  mergeCustomerContactSources,
  planAcceptedWorkCustomerBackfill,
  proposalQualifiesForActiveCustomer,
} from "@/lib/customers/activation";
import {
  findMatchingCustomer,
  planEnsureActiveCustomer,
  shouldEnsureActiveCustomer,
} from "@/lib/customers/lifecycle";

const NOW = "2026-09-17T14:00:00.000Z";
const WORKSPACE = "ws-reanvil";

const michaelSource = {
  name: "Michael Carter",
  email: "michael.carter@example.com",
  phone: "07700 900123",
  address: "14 Oak Lane, Bristol",
};

function michaelBookedPlan(
  candidates: Parameters<typeof planEnsureActiveCustomer>[0]["candidates"] = []
) {
  return planEnsureActiveCustomer({
    workspaceId: WORKSPACE,
    source: michaelSource,
    candidates,
    proposalAccepted: true,
    jobCreatedOrActivated: true,
    bookingConfirmed: true,
    nowIso: NOW,
  });
}

describe("booked job auto-creates Active Customer", () => {
  it("creates Michael Carter when a booked job has no customer yet", () => {
    const plan = michaelBookedPlan([]);
    expect(plan.triggered).toBe(true);
    expect(plan.shouldCreate).toBe(true);
    expect(plan.activatePatch.name).toBe("Michael Carter");
    expect(plan.activatePatch.email).toBe("michael.carter@example.com");
    expect(plan.activatePatch.phone).toBe("07700 900123");
    expect(plan.activatePatch.address_line_1).toBe("14 Oak Lane, Bristol");
    expect(plan.activatePatch.activated_at).toBe(NOW);
  });

  it("reuses an existing linked customer instead of creating another Michael", () => {
    const existing = {
      id: "cust-michael",
      workspace_id: WORKSPACE,
      name: "Michael Carter",
      email: "michael.carter@example.com",
      phone: "07700 900123",
      address_line_1: "14 Oak Lane, Bristol",
    };
    const plan = planEnsureActiveCustomer({
      workspaceId: WORKSPACE,
      existingCustomerId: existing.id,
      source: michaelSource,
      candidates: [existing],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: NOW,
    });
    expect(plan.shouldCreate).toBe(false);
    expect(plan.reused).toBe(true);
    expect(plan.customerId).toBe("cust-michael");
    expect(plan.matchReason).toBe("customer_id");
  });

  it("matches email in the same workspace and does not create a duplicate", () => {
    const existing = {
      id: "cust-michael",
      workspace_id: WORKSPACE,
      name: "Michael Carter",
      email: "Michael.Carter@example.com",
      phone: null,
    };
    const plan = planEnsureActiveCustomer({
      workspaceId: WORKSPACE,
      source: { ...michaelSource, phone: "0161 000 0000" },
      candidates: [existing],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: NOW,
    });
    expect(plan.shouldCreate).toBe(false);
    expect(plan.customerId).toBe("cust-michael");
    expect(plan.matchReason).toBe("email");
  });

  it("matches normalised phone in the same workspace and does not create a duplicate", () => {
    const existing = {
      id: "cust-michael",
      workspace_id: WORKSPACE,
      name: "Michael Carter",
      email: null,
      phone: "+44 7700 900123",
    };
    const plan = planEnsureActiveCustomer({
      workspaceId: WORKSPACE,
      source: { ...michaelSource, email: null },
      candidates: [existing],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: NOW,
    });
    expect(plan.shouldCreate).toBe(false);
    expect(plan.customerId).toBe("cust-michael");
    expect(plan.matchReason).toBe("phone");
  });

  it("does not merge two people who only share a name", () => {
    const other = {
      id: "cust-other",
      workspace_id: WORKSPACE,
      name: "Michael Carter",
      email: "other.michael@example.com",
      phone: "0161 555 0100",
    };
    expect(
      findMatchingCustomer([other], {
        workspaceId: WORKSPACE,
        name: "Michael Carter",
        email: "new.carter@example.com",
        phone: "07700 111222",
      })
    ).toBeNull();
    const plan = planEnsureActiveCustomer({
      workspaceId: WORKSPACE,
      source: {
        name: "Michael Carter",
        email: "new.carter@example.com",
        phone: "07700 111222",
      },
      candidates: [other],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: NOW,
    });
    expect(plan.shouldCreate).toBe(true);
    expect(plan.customerId).toBeNull();
  });

  it("keeps existing contact details instead of overwriting them with blanks", () => {
    const existing = {
      id: "cust-michael",
      workspace_id: WORKSPACE,
      name: "Michael Carter",
      email: "michael.carter@example.com",
      phone: "07700 900123",
      address_line_1: "14 Oak Lane, Bristol",
    };
    const plan = planEnsureActiveCustomer({
      workspaceId: WORKSPACE,
      existingCustomerId: existing.id,
      source: {
        name: "Michael Carter",
        email: "",
        phone: "",
        address: "",
      },
      candidates: [existing],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: NOW,
    });
    expect(plan.activatePatch.email).toBe("michael.carter@example.com");
    expect(plan.activatePatch.phone).toBe("07700 900123");
    expect(plan.activatePatch.address_line_1).toBe("14 Oak Lane, Bristol");
  });

  it("fills missing contact details from proposal, then enquiry, then visit", () => {
    const merged = mergeCustomerContactSources([
      { name: "Michael Carter", email: null, phone: null, address: null },
      {
        name: "Michael Carter",
        email: "michael.carter@example.com",
        phone: null,
        address: null,
      },
      {
        name: null,
        email: null,
        phone: "07700 900123",
        address: "14 Oak Lane, Bristol",
      },
    ]);
    expect(merged).toEqual(michaelSource);
  });

  it("is idempotent when the same booked job is activated twice", () => {
    const existing = {
      id: "cust-michael",
      workspace_id: WORKSPACE,
      ...michaelSource,
      address_line_1: michaelSource.address,
    };
    const first = planEnsureActiveCustomer({
      workspaceId: WORKSPACE,
      existingCustomerId: existing.id,
      source: michaelSource,
      candidates: [existing],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: NOW,
    });
    const second = planEnsureActiveCustomer({
      workspaceId: WORKSPACE,
      existingCustomerId: existing.id,
      source: michaelSource,
      candidates: [existing],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: "2026-09-18T14:00:00.000Z",
    });
    expect(first.customerId).toBe(second.customerId);
    expect(first.shouldCreate).toBe(false);
    expect(second.shouldCreate).toBe(false);
    expect(second.reused).toBe(true);
  });
});

describe("do not activate too early", () => {
  it("does not activate enquiry-only, visit-only, or sent-proposal work", () => {
    expect(
      shouldEnsureActiveCustomer({
        proposalAccepted: false,
        jobCreatedOrActivated: false,
        bookingConfirmed: false,
      })
    ).toBe(false);
    expect(
      proposalQualifiesForActiveCustomer({
        acceptedAt: null,
        status: "waiting_for_customer",
        bookingConfirmation: null,
        hasJob: false,
      })
    ).toBe(false);
    expect(
      proposalQualifiesForActiveCustomer({
        acceptedAt: null,
        status: "ready_to_send",
        bookingConfirmation: null,
        hasJob: false,
      })
    ).toBe(false);
  });

  it("does not activate a confirmed date when the proposal is not accepted", () => {
    expect(
      proposalQualifiesForActiveCustomer({
        acceptedAt: null,
        status: "waiting_for_customer",
        bookingConfirmation: "confirmed",
        hasJob: false,
      })
    ).toBe(false);
  });
});

describe("Michael Carter booked-job backfill", () => {
  it("creates and links Michael from an existing accepted confirmed booked job", () => {
    const plan = planAcceptedWorkCustomerBackfill({
      workspaceId: WORKSPACE,
      nowIso: NOW,
      customers: [],
      proposals: [
        {
          id: "prop-michael",
          workspaceId: WORKSPACE,
          customerId: null,
          customerName: "Michael Carter",
          customerEmail: "michael.carter@example.com",
          customerPhone: "07700 900123",
          customerAddress: "14 Oak Lane, Bristol",
          acceptedAt: NOW,
          status: "booked",
          bookingConfirmation: "confirmed",
          hasJob: true,
        },
      ],
    });

    expect(plan.createFromProposalIds).toEqual(["prop-michael"]);
    expect(plan.activateIds).toEqual([]);
    expect(plan.reuseLinks).toEqual([]);
  });

  it("reuses Michael's existing row when the booked job is backfilled again", () => {
    const plan = planAcceptedWorkCustomerBackfill({
      workspaceId: WORKSPACE,
      nowIso: NOW,
      customers: [
        {
          id: "cust-michael",
          workspace_id: WORKSPACE,
          name: "Michael Carter",
          email: "michael.carter@example.com",
          phone: "07700 900123",
        },
      ],
      proposals: [
        {
          id: "prop-michael",
          workspaceId: WORKSPACE,
          customerId: null,
          customerName: "Michael Carter",
          customerEmail: "michael.carter@example.com",
          customerPhone: "07700 900123",
          acceptedAt: NOW,
          status: "booked",
          bookingConfirmation: "confirmed",
          hasJob: true,
        },
      ],
    });

    expect(plan.createFromProposalIds).toEqual([]);
    expect(plan.reuseLinks).toEqual([
      { proposalId: "prop-michael", customerId: "cust-michael" },
    ]);
    expect(plan.activateIds).toEqual(["cust-michael"]);
  });
});

describe("shared booked-job activation path", () => {
  it("uses the real booking confirmation instead of a hardcoded false", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/jobs/create-job-from-proposal.ts"),
      "utf8"
    );
    expect(source).toContain("ensureActiveCustomerForAcceptedWork");
    expect(source).toContain('bookingConfirmed: proposal.booking_confirmation === "confirmed"');
    expect(source).not.toContain("bookingConfirmed: false");
  });

  it("routes every booked-job path through the shared job/customer helpers", () => {
    const files = [
      "lib/jobs/create-job-from-proposal.ts",
      "lib/proposals/date-workflow-persist.ts",
      "app/proposals/lifecycle-actions.ts",
      "lib/proposals/customer-portal/actions.ts",
      "lib/proposals/date-workflow-actions.ts",
      "lib/proposals/schedule/confirm-schedule-action.ts",
    ];

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(
        source.includes("ensureJobForAcceptedProposal") ||
          source.includes("promoteBookedJobIfReady") ||
          source.includes("ensureActiveCustomerForAcceptedWork")
      ).toBe(true);
      if (file !== "lib/proposals/date-workflow-actions.ts") {
        expect(source).toContain("booking_confirmation");
      }
    }
  });
});
