import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canIssueRevisedProposal,
  canReviseProposalStatus,
  hasUnsentRevision,
  isCustomerAcceptanceBlockedByRevision,
  isRevisionReadyForAcceptance,
  matchesExpectedAcceptanceRevision,
  revisedProposalAcceptError,
  staleRevisionAcceptError,
  unsentRevisionAcceptError,
} from "@/lib/proposals/revision/unsent-revision";

function readRepo(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("unsent revision accept safety", () => {
  it("treats unsent_revision_at as a hard pending lock", () => {
    expect(hasUnsentRevision({ unsent_revision_at: null })).toBe(false);
    expect(
      hasUnsentRevision({ unsent_revision_at: "2026-11-03T00:00:00.000Z" })
    ).toBe(true);
  });

  it("allows issued revisions and original quotes for acceptance", () => {
    expect(
      isRevisionReadyForAcceptance({
        unsent_revision_at: null,
        content_revision: 0,
      })
    ).toBe(true);
    expect(
      isCustomerAcceptanceBlockedByRevision({
        unsent_revision_at: null,
        content_revision: 0,
      })
    ).toBe(false);

    expect(
      isRevisionReadyForAcceptance({
        unsent_revision_at: null,
        content_revision: 1,
        issued_content_revision: 1,
      })
    ).toBe(true);
    expect(
      isCustomerAcceptanceBlockedByRevision({
        unsent_revision_at: null,
        content_revision: 1,
        issued_content_revision: 1,
      })
    ).toBe(false);

    expect(
      isCustomerAcceptanceBlockedByRevision({
        unsent_revision_at: null,
        content_revision: 1,
        issued_content_revision: null,
      })
    ).toBe(true);
    expect(
      isCustomerAcceptanceBlockedByRevision({
        unsent_revision_at: "2026-11-03T00:00:00.000Z",
        content_revision: 1,
        issued_content_revision: 1,
      })
    ).toBe(true);
  });

  it("matches expected revision only when live issued revision agrees", () => {
    expect(
      matchesExpectedAcceptanceRevision({
        expectedContentRevision: 1,
        unsent_revision_at: null,
        content_revision: 1,
        issued_content_revision: 1,
      })
    ).toBe(true);
    expect(
      matchesExpectedAcceptanceRevision({
        expectedContentRevision: 0,
        unsent_revision_at: null,
        content_revision: 1,
        issued_content_revision: 1,
      })
    ).toBe(false);
    expect(
      matchesExpectedAcceptanceRevision({
        expectedContentRevision: 0,
        unsent_revision_at: null,
        content_revision: 0,
      })
    ).toBe(true);
  });

  it("only allows revise/issue while needs_attention with unsent revision", () => {
    expect(canReviseProposalStatus("needs_attention")).toBe(true);
    expect(canReviseProposalStatus("waiting_for_customer")).toBe(false);
    expect(
      canIssueRevisedProposal({
        status: "needs_attention",
        unsent_revision_at: "2026-11-03T00:00:00.000Z",
        content_revision: 1,
        total_amount: 92000,
      })
    ).toBe(true);
    expect(
      canIssueRevisedProposal({
        status: "needs_attention",
        unsent_revision_at: null,
        content_revision: 1,
        total_amount: 92000,
      })
    ).toBe(false);
  });

  it("enforces server-side version-aware accept in portal and trader paths", () => {
    const portalActions = readRepo(
      "lib/proposals/customer-portal/actions.ts"
    );
    expect(portalActions).toContain("isCustomerAcceptanceBlockedByRevision");
    expect(portalActions).toContain("acceptProposalAtRevision");
    expect(portalActions).toContain("expectedContentRevision");
    expect(portalActions).toContain("alreadyAccepted");
    expect(portalActions).not.toContain('.eq("content_revision", 0)');

    const lifecycle = readRepo("app/proposals/lifecycle-actions.ts");
    expect(lifecycle).toContain("acceptProposalAtRevision");
    expect(lifecycle).toContain("requireWorkspaceOwner: true");
    expect(lifecycle).toContain("Issue revised proposal instead");

    const load = readRepo(
      "lib/proposals/customer-portal/load-public-proposal.ts"
    );
    expect(load).toContain("isCustomerAcceptanceBlockedByRevision");
    expect(load).toContain("revisionBlocksAccept");
    expect(load).toContain("contentRevision");

    expect(unsentRevisionAcceptError().toLowerCase()).toContain("wait");
    expect(revisedProposalAcceptError().toLowerCase()).toContain("updated");
    expect(staleRevisionAcceptError().toLowerCase()).toContain("refresh");
  });

  it("keeps save/issue separate and does not auto-send on save", () => {
    const save = readRepo(
      "lib/proposals/revision/save-proposal-revision.ts"
    );
    expect(save).toContain('rpc(\n    "save_proposal_revision"');
    expect(save).not.toContain("sendProposalToCustomer");
    expect(save).not.toContain("issue_proposal_revision");

    const issue = readRepo(
      "lib/proposals/revision/issue-revised-proposal.ts"
    );
    expect(issue).toContain("simulateIssueRevisedProposal");
    expect(issue).toContain("deferLifecycleUpdate");
    expect(issue).toContain("issue_proposal_revision");
    expect(issue).toContain("confirmIssueWithoutResending");
    expect(issue).toContain("issue_attempt_message_id");

    const markResolved = readRepo(
      "lib/proposals/change-request/actions.ts"
    );
    expect(markResolved).toContain("unsent_revision_at");
    expect(markResolved).toContain("Issue the revision before marking");
  });
});
