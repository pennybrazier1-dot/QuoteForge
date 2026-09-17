export const CUSTOMER_DELETION_GRACE_DAYS = 30;
export const CUSTOMER_LIST_SWIPE_MEDIA = "(max-width: 1023px)";

export const CUSTOMER_DELETE_CONFIRMATION =
  "This customer will be scheduled for permanent deletion in 30 days. You can restore them before then.";

export const CUSTOMER_PERMANENT_DELETE_CONFIRMATION =
  "This will permanently remove this customer now. Linked jobs, proposals, invoices, and history are kept when they are needed for your records.";

export type CustomerListView = "active" | "archived" | "scheduled";

export type CustomerLifecycleState =
  | "prospect"
  | "active"
  | "archived"
  | "scheduled_for_deletion"
  | "anonymised";

export type CustomerLifecycleFields = {
  workspace_id?: string | null;
  activated_at?: string | null;
  archived_at?: string | null;
  deletion_requested_at?: string | null;
  deletion_scheduled_for?: string | null;
  anonymised_at?: string | null;
};

export type CustomerMatchCandidate = {
  id: string;
  workspace_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line_1?: string | null;
  anonymised_at?: string | null;
};

export type EnsureCustomerSource = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type RetentionRecordCounts = {
  acceptedProposals: number;
  jobs: number;
  invoices: number;
  payments: number;
  timelineEvents: number;
  conversations: number;
  visits?: number;
};

export type PermanentDeletionPlan = {
  action: "hard_delete" | "anonymise";
  canHardDelete: boolean;
  mustRetain: boolean;
  reasons: string[];
};

export type CustomerDetailActionKey =
  | "edit"
  | "archive"
  | "restore"
  | "delete"
  | "permanent_delete"
  | "book_visit";

export type CustomerListActionKey = "archive" | "delete" | "restore" | "permanent_delete";

export type CustomerDetailActions = {
  state: CustomerLifecycleState;
  showBookVisit: boolean;
  showOverflowMenu: boolean;
    overflowActions: Array<"edit" | "archive" | "delete">;
  showEdit: boolean;
  showArchive: boolean;
  showRestore: boolean;
  showDelete: boolean;
  showPermanentDelete: boolean;
  showImmediateHardDelete: boolean;
};

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function normalizeCustomerEmail(
  email: string | null | undefined
): string | null {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}

export function normalizePhoneForMatch(
  phone: string | null | undefined
): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("44") && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  return digits.length >= 8 ? digits : null;
}

export function emailsMatch(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = normalizeCustomerEmail(left);
  const b = normalizeCustomerEmail(right);
  return Boolean(a && b && a === b);
}

export function phonesMatch(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = normalizePhoneForMatch(left);
  const b = normalizePhoneForMatch(right);
  return Boolean(a && b && a === b);
}

export function shouldEnsureActiveCustomer(input: {
  proposalAccepted: boolean;
  jobCreatedOrActivated: boolean;
  bookingConfirmed: boolean;
}): boolean {
  return (
    input.proposalAccepted &&
    input.jobCreatedOrActivated &&
    input.bookingConfirmed
  );
}

export function planQuoteSaveCustomerLink(input: {
  existingCustomerId?: string | null;
}): {
  customerId: string | null;
  shouldCreate: boolean;
  matchByName: boolean;
  matchByEmail: boolean;
  matchByPhone: boolean;
} {
  return {
    customerId: input.existingCustomerId?.trim() || null,
    shouldCreate: false,
    matchByName: false,
    matchByEmail: false,
    matchByPhone: false,
  };
}

export function canManageCustomerLifecycle(input: {
  isAuthenticated: boolean;
  isTrader: boolean;
  isPortalUser?: boolean;
  actorWorkspaceId?: string | null;
  customerWorkspaceId?: string | null;
}): { ok: boolean; reason?: string } {
  if (!input.isAuthenticated) {
    return { ok: false, reason: "not_authenticated" };
  }
  if (input.isPortalUser || !input.isTrader) {
    return { ok: false, reason: "portal_user_forbidden" };
  }
  if (
    !input.actorWorkspaceId ||
    !input.customerWorkspaceId ||
    input.actorWorkspaceId !== input.customerWorkspaceId
  ) {
    return { ok: false, reason: "workspace_mismatch" };
  }
  return { ok: true };
}

export function readCustomerLifecycleState(
  customer: CustomerLifecycleFields
): CustomerLifecycleState {
  if (customer.anonymised_at) {
    return "anonymised";
  }
  if (customer.deletion_requested_at || customer.deletion_scheduled_for) {
    return "scheduled_for_deletion";
  }
  if (customer.archived_at) {
    return "archived";
  }
  if (customer.activated_at) {
    return "active";
  }
  return "prospect";
}

export function customerBelongsInView(
  customer: CustomerLifecycleFields,
  view: CustomerListView
): boolean {
  const state = readCustomerLifecycleState(customer);
  if (view === "active") {
    return state === "active";
  }
  if (view === "archived") {
    return state === "archived";
  }
  return state === "scheduled_for_deletion";
}

export function filterCustomersByView<T extends CustomerLifecycleFields>(
  customers: T[],
  view: CustomerListView
): T[] {
  return customers.filter((customer) => customerBelongsInView(customer, view));
}

export function parseCustomerListView(
  value: string | null | undefined
): CustomerListView {
  if (value === "archived" || value === "scheduled") {
    return value;
  }
  return "active";
}

export function findMatchingCustomer<T extends CustomerMatchCandidate>(
  candidates: T[],
  query: {
    workspaceId: string;
    customerId?: string | null;
    email?: string | null;
    phone?: string | null;
    name?: string | null;
  }
): T | null {
  const inWorkspace = candidates.filter(
    (candidate) =>
      candidate.workspace_id === query.workspaceId && !candidate.anonymised_at
  );

  if (query.customerId) {
    const linked = inWorkspace.find((candidate) => candidate.id === query.customerId);
    if (linked) {
      return linked;
    }
  }

  if (query.email) {
    const byEmail = inWorkspace.find((candidate) =>
      emailsMatch(candidate.email, query.email)
    );
    if (byEmail) {
      return byEmail;
    }
  }

  if (query.phone) {
    const byPhone = inWorkspace.find((candidate) =>
      phonesMatch(candidate.phone, query.phone)
    );
    if (byPhone) {
      return byPhone;
    }
  }

  return null;
}

export function planEnsureActiveCustomer(input: {
  workspaceId: string;
  existingCustomerId?: string | null;
  source: EnsureCustomerSource;
  candidates: CustomerMatchCandidate[];
  proposalAccepted: boolean;
  jobCreatedOrActivated: boolean;
  bookingConfirmed: boolean;
  nowIso: string;
}): {
  triggered: boolean;
  shouldCreate: boolean;
  reused: boolean;
  customerId: string | null;
  matchReason: "customer_id" | "email" | "phone" | "create" | "skipped";
  activatePatch: {
    activated_at: string;
    archived_at: null;
    deletion_requested_at: null;
    deletion_scheduled_for: null;
    name: string;
    email: string | null;
    phone: string | null;
    address_line_1: string | null;
  };
} {
  const triggered = shouldEnsureActiveCustomer(input);
  const name = input.source.name?.trim() || "Customer";
  const email = input.source.email?.trim() || null;
  const phone = input.source.phone?.trim() || null;
  const address = input.source.address?.trim() || null;
  const activatePatch = {
    activated_at: input.nowIso,
    archived_at: null,
    deletion_requested_at: null,
    deletion_scheduled_for: null,
    name,
    email,
    phone,
    address_line_1: address,
  };

  if (!triggered) {
    return {
      triggered: false,
      shouldCreate: false,
      reused: false,
      customerId: input.existingCustomerId ?? null,
      matchReason: "skipped",
      activatePatch,
    };
  }

  const matched = findMatchingCustomer(input.candidates, {
    workspaceId: input.workspaceId,
    customerId: input.existingCustomerId,
    email,
    phone,
    name,
  });

  if (matched) {
    const matchReason =
      matched.id === input.existingCustomerId
        ? "customer_id"
        : emailsMatch(matched.email, email)
          ? "email"
          : "phone";
    return {
      triggered: true,
      shouldCreate: false,
      reused: true,
      customerId: matched.id,
      matchReason,
      activatePatch: {
        ...activatePatch,
        name: matched.name?.trim() || name,
        email: matched.email?.trim() || email,
        phone: matched.phone?.trim() || phone,
        address_line_1: matched.address_line_1?.trim() || address,
      },
    };
  }

  return {
    triggered: true,
    shouldCreate: true,
    reused: false,
    customerId: null,
    matchReason: "create",
    activatePatch,
  };
}

export function archiveCustomerFields(nowIso: string): {
  archived_at: string;
} {
  return { archived_at: nowIso };
}

export function restoreCustomerFields(): {
  archived_at: null;
  deletion_requested_at: null;
  deletion_scheduled_for: null;
} {
  return {
    archived_at: null,
    deletion_requested_at: null,
    deletion_scheduled_for: null,
  };
}

export function scheduleCustomerDeletionFields(nowIso: string): {
  deletion_requested_at: string;
  deletion_scheduled_for: string;
} {
  return {
    deletion_requested_at: nowIso,
    deletion_scheduled_for: addDays(nowIso, CUSTOMER_DELETION_GRACE_DAYS),
  };
}

export function canArchiveCustomer(state: CustomerLifecycleState): boolean {
  return state === "active";
}

export function canRestoreCustomer(state: CustomerLifecycleState): boolean {
  return state === "archived" || state === "scheduled_for_deletion";
}

export function canScheduleCustomerDeletion(
  state: CustomerLifecycleState
): boolean {
  return state === "active" || state === "archived";
}

export function customerDeleteConfirmation(name?: string | null): string {
  const who = name?.trim() || "this customer";
  return `Delete ${who}?\n\nThis customer will be removed from your active list and scheduled for permanent deletion in 30 days. You can restore them before then.`;
}

export function customerListRowDisplay(
  view: CustomerListView,
  options?: { isMobile?: boolean }
): {
  showName: boolean;
  showChevron: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showAddedDate: boolean;
  showDeletionDate: boolean;
} {
  const isMobile = options?.isMobile !== false;
  return {
    showName: true,
    showChevron: true,
    showEmail: !isMobile,
    showPhone: false,
    showAddress: false,
    showAddedDate: false,
    showDeletionDate: view === "scheduled",
  };
}

export function customerListSwipeActions(
  view: CustomerListView
): CustomerListActionKey[] {
  if (view === "active") {
    return ["archive", "delete"];
  }
  if (view === "archived") {
    return ["restore", "delete"];
  }
  return ["restore", "permanent_delete"];
}

export function customerListDesktopActions(
  view: CustomerListView
): CustomerListActionKey[] {
  return customerListSwipeActions(view);
}

export function canPermanentlyDeleteCustomerNow(
  state: CustomerLifecycleState
): boolean {
  return state === "scheduled_for_deletion";
}

export function inspectRetentionRecords(
  counts: RetentionRecordCounts
): PermanentDeletionPlan {
  const reasons: string[] = [];
  if (counts.acceptedProposals > 0) {
    reasons.push("accepted_proposals");
  }
  if (counts.jobs > 0) {
    reasons.push("jobs");
  }
  if (counts.invoices > 0) {
    reasons.push("invoices");
  }
  if (counts.payments > 0) {
    reasons.push("payments");
  }
  if (counts.timelineEvents > 0) {
    reasons.push("timeline");
  }
  if (counts.conversations > 0) {
    reasons.push("conversations");
  }

  const mustRetain = reasons.length > 0;
  return {
    action: mustRetain ? "anonymise" : "hard_delete",
    canHardDelete: !mustRetain,
    mustRetain,
    reasons,
  };
}

export function anonymiseCustomerFields(nowIso: string): {
  name: string;
  email: null;
  phone: null;
  address_line_1: null;
  address_line_2: null;
  town: null;
  county: null;
  postcode: null;
  notes: null;
  anonymised_at: string;
  archived_at: string;
  deletion_requested_at: string;
  deletion_scheduled_for: string | null;
} {
  return {
    name: "Former customer",
    email: null,
    phone: null,
    address_line_1: null,
    address_line_2: null,
    town: null,
    county: null,
    postcode: null,
    notes: null,
    anonymised_at: nowIso,
    archived_at: nowIso,
    deletion_requested_at: nowIso,
    deletion_scheduled_for: null,
  };
}

export function customerDetailActions(
  state: CustomerLifecycleState
): CustomerDetailActions {
  const isActive = state === "active";
  const isArchived = state === "archived";
  const isScheduled = state === "scheduled_for_deletion";

  return {
    state,
    showBookVisit: isActive,
    showOverflowMenu: isActive,
    overflowActions: isActive ? ["edit", "archive", "delete"] : [],
    showEdit: isActive,
    showArchive: isActive,
    showRestore: isArchived || isScheduled,
    showDelete: isActive || isArchived,
    showPermanentDelete: isScheduled,
    showImmediateHardDelete: false,
  };
}

export function formatDeletionScheduledFor(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}
