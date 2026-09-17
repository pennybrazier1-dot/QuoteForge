import { normalizeProposalStatus } from "@/lib/proposals/status";
import { canShowResendWaitingProposal } from "@/lib/proposals/proposal-action-eligibility";

export const WAITING_PAGE_STATUS_TITLE = "Waiting for customer response";

export function isWaitingForCustomerPage(status: string): boolean {
  return normalizeProposalStatus(status) === "waiting_for_customer";
}

export function waitingPageStatusSupport(
  customerName: string | null | undefined
): string | null {
  const name = customerName?.trim();
  return name ? `Proposal sent to ${name}` : null;
}

/** Homepage already shows the confirmed date. Do not repeat a large block here. */
export function shouldShowWaitingDateConfirmedBanner(status: string): boolean {
  return !isWaitingForCustomerPage(status);
}

export function shouldShowWaitingHoldBanner(status: string): boolean {
  return !isWaitingForCustomerPage(status);
}

export function shouldShowWaitingLifecycleCard(status: string): boolean {
  return !isWaitingForCustomerPage(status);
}

export function waitingPageForbiddenCopy(): string[] {
  return [
    "Customer chooses what happens next from their proposal link",
    "Accept, Ask a question, Request a change, or Decline",
    "Date confirmed ✓",
    "Waiting for customer to accept proposal",
  ];
}

export function defaultWorkspaceDisclosureOpen(
  viewport: "mobile" | "desktop"
): boolean {
  return viewport === "desktop";
}

export function waitingPageTopActions(status: string): {
  resend: boolean;
  pdf: boolean;
  edit: boolean;
} {
  const waiting = isWaitingForCustomerPage(status);
  return {
    resend: waiting && canShowResendWaitingProposal(status),
    pdf: waiting,
    edit: waiting,
  };
}

export function buildWaitingPageLayout(input: {
  status: string;
  customerName?: string | null;
  viewport: "mobile" | "desktop";
}) {
  const waiting = isWaitingForCustomerPage(input.status);
  const open = defaultWorkspaceDisclosureOpen(input.viewport);

  return {
    waiting,
    statusTitle: waiting ? WAITING_PAGE_STATUS_TITLE : null,
    statusSupport: waiting ? waitingPageStatusSupport(input.customerName) : null,
    showDateConfirmedBanner: waiting
      ? false
      : shouldShowWaitingDateConfirmedBanner(input.status),
    showHoldBanner: waiting ? false : shouldShowWaitingHoldBanner(input.status),
    showWaitingLifecycleCard: shouldShowWaitingLifecycleCard(input.status),
    conversationDefaultOpen: open,
    timelineDefaultOpen: open,
    customerDetailsDefaultOpen: open,
    topActions: waitingPageTopActions(input.status),
    forbiddenCopy: waiting ? waitingPageForbiddenCopy() : [],
    lifecycleUnchanged: true,
  };
}
