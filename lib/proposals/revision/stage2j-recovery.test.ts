import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOCKED / static source regression checks for Stage 2J recovery contracts.
 * Real transaction behaviour is covered by scripts/stage2j-recovery-db-test.mjs.
 */
function readRepo(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("Stage 2J recovery contracts (source)", () => {
  it("does not permanently skip job work on alreadyAccepted", () => {
    const portal = readRepo("lib/proposals/customer-portal/actions.ts");
    expect(portal).toContain("alreadyBookedAtExpected");
    expect(portal).toContain("ensureJobForAcceptedProposal");
    // alreadyAccepted path must still call ensureJob
    const alreadyBlock = portal.slice(
      portal.indexOf("Always ensure job"),
      portal.indexOf("Always ensure job") + 400
    );
    expect(alreadyBlock).toContain("ensureJobForAcceptedProposal");
  });

  it("validates slots before accept and binds them atomically in accept RPC", () => {
    const portal = readRepo("lib/proposals/customer-portal/actions.ts");
    const fnStart = portal.indexOf("export async function acceptPublicProposal");
    const fnBody = portal.slice(fnStart, fnStart + 7000);
    expect(fnBody).toContain("previewPublicSlotHold");
    expect(fnBody).toContain("requireSlot");
    expect(fnBody).toContain("acceptance + slot reservation are atomic");
    const previewIdx = fnBody.indexOf("previewPublicSlotHold");
    const acceptIdx = fnBody.indexOf("acceptProposalAtRevision");
    expect(previewIdx).toBeGreaterThan(-1);
    expect(previewIdx).toBeLessThan(acceptIdx);
    // Post-accept applyPublicSlotHold must not remain on the accept path.
    const afterAccept = fnBody.slice(acceptIdx);
    expect(afterAccept).not.toContain("applyPublicSlotHold(");
  });

  it("binds issue recovery to the exact attempt revision", () => {
    const issue = readRepo("lib/proposals/revision/issue-revised-proposal.ts");
    expect(issue).toContain("issue_attempt_content_revision");
    expect(issue).toContain("belongs to a different revision");
    expect(issue).toContain("confirmIssueWithoutResending");
  });

  it("blocks outbound email on local Supabase at the transport helpers", () => {
    const proposal = readRepo("lib/email/send-proposal-email.ts");
    const notify = readRepo("lib/email/send-notification-email.ts");
    expect(proposal).toContain("outboundEmailBlockReason");
    expect(notify).toContain("outboundEmailBlockReason");
  });

  it("backfills missing job prep items on ensureJob retries", () => {
    const jobs = readRepo("lib/jobs/create-job-from-proposal.ts");
    expect(jobs).toContain("ensureMissingPrepItems");
  });
});
