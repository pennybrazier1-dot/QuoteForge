/**
 * Customer-facing proposal surfaces must never render labour.
 * Labour remains in structured data and the database for internal costing.
 */

/** UI / copy patterns that must not appear in customer-facing proposal files. */
export const LABOUR_CUSTOMER_FACING_FORBIDDEN_PATTERNS = [
  /ProposalSectionBlock\s+title=["']Labour["']/,
  /qf-card-heading">Labour</,
  /title:\s*["']Labour["']/,
  /Including\s+labour\b/i,
  /\btitle=["']Labour["']/,
] as const;

export const CUSTOMER_FACING_PROPOSAL_FILES = [
  "components/proposals/structured-proposal-content.tsx",
  "components/proposals/editable-proposal-review.tsx",
  "components/proposals/proposal-workspace.tsx",
  "components/proposals/generated-proposal-preview.tsx",
  "components/proposals/structured-proposal-view.tsx",
  "components/proposals/send-proposal-dialog.tsx",
  "lib/proposals/pdf/render.ts",
  "lib/proposals/send-proposal-defaults.ts",
  "lib/email/send-proposal-email.ts",
] as const;

export function findLabourInCustomerFacingSource(source: string): string | null {
  for (const pattern of LABOUR_CUSTOMER_FACING_FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      return pattern.source;
    }
  }

  return null;
}
