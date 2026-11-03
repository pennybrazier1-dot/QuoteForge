import { createHash } from "node:crypto";

/** Stable per-proposal+revision key for provider + DB claim binding. */
export function buildIssueSendClaimKey(
  proposalId: string,
  contentRevision: number
): string {
  const digest = createHash("sha256")
    .update(`issue-rev:${proposalId}:${contentRevision}`)
    .digest("hex")
    .slice(0, 32);
  return `qf-issue-${digest}`;
}
