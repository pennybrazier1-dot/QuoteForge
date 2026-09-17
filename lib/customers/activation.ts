import {
  emailsMatch,
  findMatchingCustomer,
  phonesMatch,
  shouldEnsureActiveCustomer,
  type CustomerMatchCandidate,
  type EnsureCustomerSource,
} from "@/lib/customers/lifecycle";

export type QualifyingProposalInput = {
  acceptedAt?: string | null;
  status?: string | null;
  bookingConfirmation?: string | null;
  hasJob?: boolean;
};

export type ActivationProposal = QualifyingProposalInput & {
  id: string;
  workspaceId: string;
  customerId?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
};

export type ActivationCustomer = CustomerMatchCandidate & {
  activatedAt?: string | null;
  archivedAt?: string | null;
  deletionRequestedAt?: string | null;
};

export function firstNonEmptyContact(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

export function mergeCustomerContactSources(
  sources: Array<EnsureCustomerSource | null | undefined>
): EnsureCustomerSource {
  return {
    name: firstNonEmptyContact(...sources.map((source) => source?.name)),
    email: firstNonEmptyContact(...sources.map((source) => source?.email)),
    phone: firstNonEmptyContact(...sources.map((source) => source?.phone)),
    address: firstNonEmptyContact(...sources.map((source) => source?.address)),
  };
}

export function isProposalAcceptedForCustomer(
  input: QualifyingProposalInput
): boolean {
  const status = (input.status ?? "").toLowerCase();
  return (
    Boolean(input.acceptedAt) || status === "booked" || status === "completed"
  );
}

export function isBookingConfirmedForCustomer(
  bookingConfirmation?: string | null
): boolean {
  return bookingConfirmation === "confirmed";
}

export function proposalQualifiesForActiveCustomer(
  input: QualifyingProposalInput
): boolean {
  return shouldEnsureActiveCustomer({
    proposalAccepted: isProposalAcceptedForCustomer(input),
    jobCreatedOrActivated: Boolean(input.hasJob),
    bookingConfirmed: isBookingConfirmedForCustomer(input.bookingConfirmation),
  });
}

export function shouldPreserveCustomerLifecycle(input: {
  archivedAt?: string | null;
  deletionRequestedAt?: string | null;
  anonymisedAt?: string | null;
}): boolean {
  return Boolean(
    input.archivedAt || input.deletionRequestedAt || input.anonymisedAt
  );
}

export function shouldDeactivateLegacyAutoCustomer(input: {
  activatedAt?: string | null;
  archivedAt?: string | null;
  deletionRequestedAt?: string | null;
  anonymisedAt?: string | null;
  hasQualifyingWork: boolean;
  hasLinkedProposalOrJob: boolean;
}): boolean {
  if (input.anonymisedAt || input.archivedAt || input.deletionRequestedAt) {
    return false;
  }
  if (!input.activatedAt) {
    return false;
  }
  if (input.hasQualifyingWork) {
    return false;
  }
  // Quote/enquiry-created contacts were activated by the first loose backfill.
  // Manual adds usually have no linked proposal or job, so they stay Active.
  return input.hasLinkedProposalOrJob;
}

export function planAcceptedWorkCustomerBackfill(input: {
  workspaceId: string;
  proposals: ActivationProposal[];
  customers: ActivationCustomer[];
  nowIso: string;
}): {
  activateIds: string[];
  createFromProposalIds: string[];
  reuseLinks: Array<{ proposalId: string; customerId: string }>;
  deactivateIds: string[];
} {
  const activateIds = new Set<string>();
  const createFromProposalIds: string[] = [];
  const reuseLinks: Array<{ proposalId: string; customerId: string }> = [];
  const qualifyingByCustomer = new Set<string>();
  const linkedCustomerIds = new Set<string>();

  for (const proposal of input.proposals) {
    if (proposal.customerId) {
      linkedCustomerIds.add(proposal.customerId);
    }
    if (!proposalQualifiesForActiveCustomer(proposal)) {
      continue;
    }

    const matched = findMatchingCustomer(input.customers, {
      workspaceId: input.workspaceId,
      customerId: proposal.customerId,
      email: proposal.customerEmail,
      phone: proposal.customerPhone,
      name: proposal.customerName,
    });

    if (matched) {
      if (
        !shouldPreserveCustomerLifecycle({
          archivedAt: matched.archivedAt,
          deletionRequestedAt: matched.deletionRequestedAt,
          anonymisedAt: matched.anonymised_at,
        })
      ) {
        activateIds.add(matched.id);
      }
      qualifyingByCustomer.add(matched.id);
      if (proposal.customerId !== matched.id) {
        reuseLinks.push({ proposalId: proposal.id, customerId: matched.id });
      }
      continue;
    }

    createFromProposalIds.push(proposal.id);
  }

  const deactivateIds = input.customers
    .filter((customer) =>
      shouldDeactivateLegacyAutoCustomer({
        activatedAt: customer.activatedAt,
        hasQualifyingWork: qualifyingByCustomer.has(customer.id),
        hasLinkedProposalOrJob: linkedCustomerIds.has(customer.id),
      })
    )
    .map((customer) => customer.id);

  return {
    activateIds: [...activateIds],
    createFromProposalIds,
    reuseLinks,
    deactivateIds,
  };
}

export function sameCustomerContact(
  left: { email?: string | null; phone?: string | null },
  right: { email?: string | null; phone?: string | null }
): boolean {
  return emailsMatch(left.email, right.email) || phonesMatch(left.phone, right.phone);
}
