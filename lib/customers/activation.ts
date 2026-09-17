import {
  emailsMatch,
  findMatchingCustomer,
  phonesMatch,
  shouldEnsureActiveCustomer,
  type CustomerMatchCandidate,
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

export function proposalQualifiesForActiveCustomer(
  input: QualifyingProposalInput
): boolean {
  return shouldEnsureActiveCustomer({
    proposalAccepted: Boolean(input.acceptedAt),
    jobCreatedOrActivated:
      Boolean(input.hasJob) || input.status === "completed",
    bookingConfirmed: input.bookingConfirmation === "confirmed",
  });
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
      activateIds.add(matched.id);
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
