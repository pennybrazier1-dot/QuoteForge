import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  planAcceptedWorkCustomerBackfill,
  proposalQualifiesForActiveCustomer,
  shouldDeactivateLegacyAutoCustomer,
} from "@/lib/customers/activation";
import {
  canManageCustomerLifecycle,
  customerListDesktopActions,
  customerListRowDisplay,
  customerListSwipeActions,
  filterCustomersByView,
  findMatchingCustomer,
  planEnsureActiveCustomer,
  shouldEnsureActiveCustomer,
} from "@/lib/customers/lifecycle";

const NOW = "2026-09-17T12:00:00.000Z";

describe("active customer eligibility", () => {
  it("activates Michael-style accepted and booked work", () => {
    expect(
      proposalQualifiesForActiveCustomer({
        acceptedAt: NOW,
        bookingConfirmation: "confirmed",
        hasJob: true,
        status: "booked",
      })
    ).toBe(true);
    expect(
      shouldEnsureActiveCustomer({
        proposalAccepted: true,
        jobCreatedOrActivated: true,
        bookingConfirmed: true,
      })
    ).toBe(true);
  });

  it("does not activate when the date is confirmed but the proposal is not accepted", () => {
    expect(
      proposalQualifiesForActiveCustomer({
        acceptedAt: null,
        bookingConfirmation: "confirmed",
        hasJob: false,
        status: "waiting_for_customer",
      })
    ).toBe(false);
  });

  it("does not activate enquiry, visit, draft, or sent-proposal-only people", () => {
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
        status: "draft",
        hasJob: false,
      })
    ).toBe(false);
    expect(
      proposalQualifiesForActiveCustomer({
        acceptedAt: null,
        status: "ready_to_send",
        hasJob: false,
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
  });

  it("reuses an existing matching customer and does not create a duplicate Michael", () => {
    const existing = {
      id: "cust-michael",
      workspace_id: "ws-reanvil",
      name: "Michael Carter",
      email: "michael.carter@example.com",
      phone: "07700 900123",
    };
    const plan = planEnsureActiveCustomer({
      workspaceId: "ws-reanvil",
      source: {
        name: "Michael Carter",
        email: "Michael.Carter@example.com",
        phone: "07700 900123",
        address: "14 Oak Lane, Bristol",
      },
      candidates: [existing],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: NOW,
    });
    expect(plan.shouldCreate).toBe(false);
    expect(plan.reused).toBe(true);
    expect(plan.customerId).toBe("cust-michael");
    expect(
      findMatchingCustomer([existing], {
        workspaceId: "ws-reanvil",
        email: "michael.carter@example.com",
      })?.id
    ).toBe("cust-michael");
  });

  it("keeps a manually added customer Active when they have no linked work", () => {
    expect(
      shouldDeactivateLegacyAutoCustomer({
        activatedAt: NOW,
        hasQualifyingWork: false,
        hasLinkedProposalOrJob: false,
      })
    ).toBe(false);
  });
});

describe("legacy activation backfill", () => {
  it("creates Michael from accepted booked work when no customer row exists", () => {
    const plan = planAcceptedWorkCustomerBackfill({
      workspaceId: "ws-reanvil",
      nowIso: NOW,
      customers: [],
      proposals: [
        {
          id: "prop-michael",
          workspaceId: "ws-reanvil",
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
    expect(plan.deactivateIds).toEqual([]);
  });

  it("deactivates James-style quote-only contacts that the first backfill marked Active", () => {
    const plan = planAcceptedWorkCustomerBackfill({
      workspaceId: "ws-reanvil",
      nowIso: NOW,
      customers: [
        {
          id: "cust-james",
          workspace_id: "ws-reanvil",
          name: "James Walker",
          email: "james@example.com",
          phone: null,
          activatedAt: NOW,
        },
      ],
      proposals: [
        {
          id: "prop-james",
          workspaceId: "ws-reanvil",
          customerId: "cust-james",
          customerName: "James Walker",
          customerEmail: "james@example.com",
          acceptedAt: null,
          status: "waiting_for_customer",
          bookingConfirmation: null,
          hasJob: false,
        },
      ],
    });

    expect(plan.deactivateIds).toEqual(["cust-james"]);
    expect(plan.createFromProposalIds).toEqual([]);
  });
});

describe("customer list display and actions", () => {
  it("shows only the name on the Active mobile list row", () => {
    const row = customerListRowDisplay("active");
    expect(row.showName).toBe(true);
    expect(row.showEmail).toBe(false);
    expect(row.showPhone).toBe(false);
    expect(row.showAddress).toBe(false);
    expect(row.showAddedDate).toBe(false);
  });

  it("opens Customer Detail from the name row and hides contact details in the list", () => {
    const source = readFileSync(
      join(process.cwd(), "components/customers/customer-list.tsx"),
      "utf8"
    );
    expect(source).toContain("customerDetailHref");
    expect(source).not.toContain("customer.phone");
    expect(source).not.toContain("formatCustomerCreatedAt");
    expect(source).toContain("CUSTOMER_LIST_SWIPE_MEDIA");
    expect(source).toContain("customerListDesktopActions");
  });

  it("reveals Archive and Delete on swipe, and the same actions on desktop", () => {
    expect(customerListSwipeActions("active")).toEqual(["archive", "delete"]);
    expect(customerListDesktopActions("active")).toEqual(["archive", "delete"]);
    expect(customerListSwipeActions("archived")).toEqual(["restore", "delete"]);
    expect(customerListSwipeActions("scheduled")).toEqual([
      "restore",
      "permanent_delete",
    ]);
  });

  it("keeps a customer in only one lifecycle list", () => {
    const customer = {
      workspace_id: "ws-reanvil",
      name: "Michael Carter",
      activated_at: NOW,
      archived_at: null,
      deletion_requested_at: null,
      deletion_scheduled_for: null,
    };
    expect(filterCustomersByView([customer], "active")).toHaveLength(1);
    expect(filterCustomersByView([customer], "archived")).toHaveLength(0);
    expect(filterCustomersByView([customer], "scheduled")).toHaveLength(0);

    const archived = { ...customer, archived_at: NOW };
    expect(filterCustomersByView([archived], "active")).toHaveLength(0);
    expect(filterCustomersByView([archived], "archived")).toHaveLength(1);

    const scheduled = {
      ...customer,
      deletion_requested_at: NOW,
      deletion_scheduled_for: "2026-10-17T12:00:00.000Z",
    };
    expect(filterCustomersByView([scheduled], "active")).toHaveLength(0);
    expect(filterCustomersByView([scheduled], "archived")).toHaveLength(0);
    expect(filterCustomersByView([scheduled], "scheduled")).toHaveLength(1);
  });

  it("keeps customer lifecycle actions inside the trader workspace", () => {
    expect(
      canManageCustomerLifecycle({
        isAuthenticated: true,
        isTrader: true,
        actorWorkspaceId: "ws-reanvil",
        customerWorkspaceId: "ws-other",
      }).ok
    ).toBe(false);
    expect(
      canManageCustomerLifecycle({
        isAuthenticated: true,
        isTrader: true,
        actorWorkspaceId: "ws-reanvil",
        customerWorkspaceId: "ws-reanvil",
      }).ok
    ).toBe(true);
  });
});
