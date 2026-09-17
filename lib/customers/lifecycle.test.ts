import { describe, expect, it } from "vitest";
import {
  CUSTOMER_DELETE_CONFIRMATION,
  CUSTOMER_DELETION_GRACE_DAYS,
  anonymiseCustomerFields,
  archiveCustomerFields,
  canArchiveCustomer,
  canManageCustomerLifecycle,
  canPermanentlyDeleteCustomerNow,
  canRestoreCustomer,
  canScheduleCustomerDeletion,
  customerDetailActions,
  filterCustomersByView,
  findMatchingCustomer,
  inspectRetentionRecords,
  parseCustomerListView,
  planEnsureActiveCustomer,
  planQuoteSaveCustomerLink,
  restoreCustomerFields,
  scheduleCustomerDeletionFields,
  shouldEnsureActiveCustomer,
} from "@/lib/customers/lifecycle";

const NOW = "2026-09-17T10:00:00.000Z";

const michaelCarter = {
  id: "customer-michael",
  workspace_id: "ws-reanvil",
  name: "Michael Carter",
  email: "michael.carter@example.com",
  phone: "07700 900123",
};

describe("customer auto-create trigger", () => {
  it("does not auto-create an active customer from an enquiry or quote alone", () => {
    expect(
      shouldEnsureActiveCustomer({
        proposalAccepted: false,
        jobCreatedOrActivated: false,
        bookingConfirmed: false,
      })
    ).toBe(false);
    expect(
      planQuoteSaveCustomerLink({ existingCustomerId: null })
    ).toEqual({
      customerId: null,
      shouldCreate: false,
      matchByName: false,
      matchByEmail: false,
      matchByPhone: false,
    });
    expect(
      planEnsureActiveCustomer({
        workspaceId: "ws-reanvil",
        source: michaelCarter,
        candidates: [],
        proposalAccepted: false,
        jobCreatedOrActivated: false,
        bookingConfirmed: false,
        nowIso: NOW,
      }).triggered
    ).toBe(false);
  });

  it("creates or links a customer when accepted work is booked or a job exists", () => {
    expect(
      shouldEnsureActiveCustomer({
        proposalAccepted: true,
        jobCreatedOrActivated: true,
        bookingConfirmed: false,
      })
    ).toBe(true);
    expect(
      shouldEnsureActiveCustomer({
        proposalAccepted: true,
        jobCreatedOrActivated: false,
        bookingConfirmed: true,
      })
    ).toBe(true);
    expect(
      shouldEnsureActiveCustomer({
        proposalAccepted: false,
        jobCreatedOrActivated: true,
        bookingConfirmed: true,
      })
    ).toBe(false);
  });

  it("adds Michael Carter to Active Customers after an accepted proposal and confirmed booking", () => {
    const plan = planEnsureActiveCustomer({
      workspaceId: "ws-reanvil",
      source: {
        name: "Michael Carter",
        email: "michael.carter@example.com",
        phone: "07700 900123",
        address: "14 Oak Lane, Bristol",
      },
      candidates: [],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: NOW,
    });

    expect(plan.triggered).toBe(true);
    expect(plan.shouldCreate).toBe(true);
    expect(plan.activatePatch.name).toBe("Michael Carter");

    const listed = filterCustomersByView(
      [
        {
          workspace_id: "ws-reanvil",
          activated_at: plan.activatePatch.activated_at,
          archived_at: plan.activatePatch.archived_at,
          deletion_requested_at: plan.activatePatch.deletion_requested_at,
          deletion_scheduled_for: plan.activatePatch.deletion_scheduled_for,
          name: plan.activatePatch.name,
        },
      ],
      "active"
    );

    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("Michael Carter");
  });
});

describe("customer matching", () => {
  it("reuses an existing linked customer instead of creating another", () => {
    const plan = planEnsureActiveCustomer({
      workspaceId: "ws-reanvil",
      existingCustomerId: michaelCarter.id,
      source: michaelCarter,
      candidates: [michaelCarter],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: NOW,
    });

    expect(plan.shouldCreate).toBe(false);
    expect(plan.reused).toBe(true);
    expect(plan.customerId).toBe("customer-michael");
    expect(plan.matchReason).toBe("customer_id");
  });

  it("prevents a duplicate customer when the same email exists in the same workspace", () => {
    const plan = planEnsureActiveCustomer({
      workspaceId: "ws-reanvil",
      source: {
        name: "Mike Carter",
        email: "Michael.Carter@example.com",
        phone: "0161 000 0000",
      },
      candidates: [michaelCarter],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: NOW,
    });

    expect(plan.shouldCreate).toBe(false);
    expect(plan.customerId).toBe("customer-michael");
    expect(plan.matchReason).toBe("email");
  });

  it("reuses a customer when the same workspace phone is a safe match", () => {
    const plan = planEnsureActiveCustomer({
      workspaceId: "ws-reanvil",
      source: {
        name: "Mike C",
        email: null,
        phone: "+44 7700 900123",
      },
      candidates: [michaelCarter],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: NOW,
    });

    expect(plan.shouldCreate).toBe(false);
    expect(plan.customerId).toBe("customer-michael");
    expect(plan.matchReason).toBe("phone");
  });

  it("does not merge two people who only share a name", () => {
    const otherMichael = {
      id: "customer-other-michael",
      workspace_id: "ws-reanvil",
      name: "Michael Carter",
      email: "other.michael@example.com",
      phone: "0161 555 0100",
    };

    expect(
      findMatchingCustomer([otherMichael], {
        workspaceId: "ws-reanvil",
        name: "Michael Carter",
        email: null,
        phone: null,
      })
    ).toBeNull();

    const plan = planEnsureActiveCustomer({
      workspaceId: "ws-reanvil",
      source: {
        name: "Michael Carter",
        email: "new.carter@example.com",
        phone: "07700 111222",
      },
      candidates: [otherMichael],
      proposalAccepted: true,
      jobCreatedOrActivated: true,
      bookingConfirmed: true,
      nowIso: NOW,
    });

    expect(plan.shouldCreate).toBe(true);
    expect(plan.customerId).toBeNull();
  });
});

describe("archive, restore, and deletion window", () => {
  const activeMichael = {
    workspace_id: "ws-reanvil",
    name: "Michael Carter",
    activated_at: NOW,
    archived_at: null,
    deletion_requested_at: null,
    deletion_scheduled_for: null,
  };

  it("archives an active customer without deleting history", () => {
    expect(canArchiveCustomer("active")).toBe(true);
    expect(archiveCustomerFields(NOW)).toEqual({ archived_at: NOW });

    const archived = { ...activeMichael, ...archiveCustomerFields(NOW) };
    expect(filterCustomersByView([archived], "active")).toHaveLength(0);
    expect(filterCustomersByView([archived], "archived")).toHaveLength(1);
    expect(filterCustomersByView([archived], "archived")[0]?.name).toBe(
      "Michael Carter"
    );
  });

  it("restores an archived customer back to the Active list", () => {
    const archived = { ...activeMichael, archived_at: NOW };
    expect(canRestoreCustomer("archived")).toBe(true);
    const restored = { ...archived, ...restoreCustomerFields() };
    expect(filterCustomersByView([restored], "active")).toHaveLength(1);
    expect(filterCustomersByView([restored], "archived")).toHaveLength(0);
  });

  it("starts a 30-day deletion window only from the Archived state", () => {
    expect(canScheduleCustomerDeletion("active")).toBe(false);
    expect(canScheduleCustomerDeletion("archived")).toBe(true);
    expect(CUSTOMER_DELETE_CONFIRMATION).toContain(
      "scheduled for permanent deletion in 30 days"
    );
    expect(CUSTOMER_DELETION_GRACE_DAYS).toBe(30);

    const scheduled = {
      ...activeMichael,
      archived_at: NOW,
      ...scheduleCustomerDeletionFields(NOW),
    };
    expect(scheduled.deletion_requested_at).toBe(NOW);
    expect(scheduled.deletion_scheduled_for).toBe("2026-10-17T10:00:00.000Z");
    expect(filterCustomersByView([scheduled], "active")).toHaveLength(0);
    expect(filterCustomersByView([scheduled], "archived")).toHaveLength(0);
    expect(filterCustomersByView([scheduled], "scheduled")).toHaveLength(1);
  });

  it("lets a trader restore a customer during the deletion window and cancels the schedule", () => {
    expect(canRestoreCustomer("scheduled_for_deletion")).toBe(true);
    const scheduled = {
      ...activeMichael,
      archived_at: NOW,
      deletion_requested_at: NOW,
      deletion_scheduled_for: "2026-10-17T10:00:00.000Z",
    };
    const restored = {
      ...scheduled,
      ...restoreCustomerFields(),
    };
    expect(restored.archived_at).toBeNull();
    expect(restored.deletion_requested_at).toBeNull();
    expect(restored.deletion_scheduled_for).toBeNull();
    expect(filterCustomersByView([restored], "active")).toHaveLength(1);
    expect(filterCustomersByView([restored], "scheduled")).toHaveLength(0);
  });
});

describe("permanent deletion and ownership", () => {
  it("does not blindly destroy retention-critical history", () => {
    const retained = inspectRetentionRecords({
      acceptedProposals: 1,
      jobs: 1,
      invoices: 0,
      payments: 0,
      timelineEvents: 4,
      conversations: 2,
    });
    expect(retained.mustRetain).toBe(true);
    expect(retained.canHardDelete).toBe(false);
    expect(retained.action).toBe("anonymise");
    expect(retained.reasons).toEqual([
      "accepted_proposals",
      "jobs",
      "timeline",
      "conversations",
    ]);

    const anonymised = anonymiseCustomerFields(NOW);
    expect(anonymised.name).toBe("Former customer");
    expect(anonymised.email).toBeNull();
    expect(anonymised.phone).toBeNull();
    expect(anonymised.notes).toBeNull();
    expect(anonymised.anonymised_at).toBe(NOW);

    const safe = inspectRetentionRecords({
      acceptedProposals: 0,
      jobs: 0,
      invoices: 0,
      payments: 0,
      timelineEvents: 0,
      conversations: 0,
    });
    expect(safe.action).toBe("hard_delete");
    expect(safe.canHardDelete).toBe(true);
  });

  it("enforces workspace ownership and blocks customer-portal users", () => {
    expect(
      canManageCustomerLifecycle({
        isAuthenticated: true,
        isTrader: true,
        actorWorkspaceId: "ws-reanvil",
        customerWorkspaceId: "ws-reanvil",
      }).ok
    ).toBe(true);

    expect(
      canManageCustomerLifecycle({
        isAuthenticated: true,
        isTrader: true,
        actorWorkspaceId: "ws-reanvil",
        customerWorkspaceId: "ws-other",
      })
    ).toEqual({ ok: false, reason: "workspace_mismatch" });

    expect(
      canManageCustomerLifecycle({
        isAuthenticated: true,
        isTrader: false,
        isPortalUser: true,
        actorWorkspaceId: "ws-reanvil",
        customerWorkspaceId: "ws-reanvil",
      })
    ).toEqual({ ok: false, reason: "portal_user_forbidden" });

    expect(
      findMatchingCustomer(
        [
          {
            ...michaelCarter,
            workspace_id: "ws-other",
          },
        ],
        {
          workspaceId: "ws-reanvil",
          email: michaelCarter.email,
        }
      )
    ).toBeNull();
  });
});

describe("customer detail mobile actions", () => {
  it("keeps immediate hard delete off the active customer surface", () => {
    const actions = customerDetailActions("active");
    expect(actions.showOverflowMenu).toBe(true);
    expect(actions.overflowActions).toEqual(["edit", "archive"]);
    expect(actions.showDelete).toBe(false);
    expect(actions.showPermanentDelete).toBe(false);
    expect(actions.showImmediateHardDelete).toBe(false);
    expect(canPermanentlyDeleteCustomerNow("active")).toBe(false);
    expect(parseCustomerListView(undefined)).toBe("active");
  });

  it("exposes Restore and Delete on an archived customer", () => {
    const actions = customerDetailActions("archived");
    expect(actions.showRestore).toBe(true);
    expect(actions.showDelete).toBe(true);
    expect(actions.showArchive).toBe(false);
    expect(actions.showOverflowMenu).toBe(false);
    expect(actions.showPermanentDelete).toBe(false);
  });

  it("shows restore and a safe permanent-delete path while scheduled", () => {
    const actions = customerDetailActions("scheduled_for_deletion");
    expect(actions.showRestore).toBe(true);
    expect(actions.showPermanentDelete).toBe(true);
    expect(actions.showImmediateHardDelete).toBe(false);
    expect(canPermanentlyDeleteCustomerNow("scheduled_for_deletion")).toBe(
      true
    );
  });
});
