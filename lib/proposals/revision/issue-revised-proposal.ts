"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import {
  isDevTestingEnabled,
  devTestingDisabledMessage,
} from "@/lib/env/dev-testing";
import { sendProposalToCustomer } from "@/lib/proposals/send-proposal-to-customer";
import {
  canIssueRevisedProposal,
} from "@/lib/proposals/revision/unsent-revision";
import { buildIssueSendClaimKey } from "@/lib/proposals/revision/issue-send-claim-key";
import { normalizeProposalStatus } from "@/lib/proposals/status";
import { ensureProposalCustomerAccessToken } from "@/lib/proposals/customer-portal/ensure-token";
import {
  generateFreshProposalPdfBuffer,
  loadProposalPdfContext,
} from "@/lib/proposals/load-proposal-pdf";

export type IssueRevisedProposalState = {
  error?: string;
  ok?: boolean;
  simulated?: boolean;
  alreadyIssued?: boolean;
  previousTotalPence?: number;
  newTotalPence?: number;
  revisionNumber?: number;
  messageId?: string;
  /**
   * Provider accepted the send request (or simulation recorded).
   * This is not proof the customer opened or received the email.
   */
  providerAccepted?: boolean;
  claimHeld?: boolean;
  unknownOutcome?: boolean;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

type IssueRpcResult = {
  ok?: boolean;
  error?: string;
  already_issued?: boolean;
  content_revision?: number;
  previous_total_amount?: number;
  new_total_amount?: number;
  message_id?: string;
  provider?: string;
};

type ClaimRpcResult = {
  ok?: boolean;
  error?: string;
  already_claimed?: boolean;
  claim_held?: boolean;
  claim_key?: string;
  content_revision?: number;
  stale_revision?: boolean;
};

function revalidateIssuePaths(proposalId: string) {
  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath(`/proposals/${proposalId}/revise`);
  revalidatePath("/dashboard");
  revalidatePath("/proposals");
}

async function claimIssueSend(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    proposalId: string;
    expectedContentRevision: number;
    claimKey: string;
  }
): Promise<{ ok: true; alreadyClaimed: boolean } | { ok: false; error: string; claimHeld?: boolean }> {
  const { data, error } = await supabase.rpc("claim_proposal_revision_send", {
    p_proposal_id: input.proposalId,
    p_expected_content_revision: input.expectedContentRevision,
    p_claim_key: input.claimKey,
  });

  if (error) {
    return {
      ok: false,
      error: error.message || "Could not claim this revision for sending.",
      claimHeld: true,
    };
  }

  const result = (data ?? {}) as ClaimRpcResult;
  if (!result.ok) {
    return {
      ok: false,
      error: result.error || "Could not claim this revision for sending.",
      claimHeld: Boolean(result.claim_held),
    };
  }

  return { ok: true, alreadyClaimed: Boolean(result.already_claimed) };
}

async function recordIssueAttempt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    proposalId: string;
    expectedContentRevision: number;
    provider: "simulated" | "resend";
    messageId: string;
  }
): Promise<{ ok: true } | { ok: false; zeroRows?: boolean; error: string }> {
  const { data, error } = await supabase
    .from("proposals")
    .update({
      issue_attempt_at: new Date().toISOString(),
      issue_attempt_provider: input.provider,
      issue_attempt_message_id: input.messageId,
      issue_attempt_content_revision: input.expectedContentRevision,
    })
    .eq("id", input.proposalId)
    .eq("content_revision", input.expectedContentRevision)
    .not("unsent_revision_at", "is", null)
    .select("id");

  if (error) {
    return {
      ok: false,
      error: error.message || "Could not store the issue attempt.",
    };
  }

  if (!data || data.length === 0) {
    return {
      ok: false,
      zeroRows: true,
      error:
        "Could not store the issue attempt for this revision (zero rows updated). Do not resend yet — refresh and use Confirm issue if a provider message id is visible.",
    };
  }

  return { ok: true };
}

async function finalizeIssue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    proposalId: string;
    expectedContentRevision: number;
    provider: "simulated" | "resend";
    messageId: string;
    claimKey: string;
  }
): Promise<IssueRevisedProposalState> {
  const { data, error } = await supabase.rpc("issue_proposal_revision", {
    p_proposal_id: input.proposalId,
    p_expected_content_revision: input.expectedContentRevision,
    p_provider: input.provider,
    p_message_id: input.messageId,
    p_claim_key: input.claimKey,
  });

  if (error) {
    return {
      error:
        input.provider === "resend"
          ? "The email provider accepted the message, but Reanvil could not mark the revision issued. Refresh and check before retrying."
          : error.message || "Could not mark the revision as issued.",
      providerAccepted: input.provider === "resend",
      unknownOutcome: true,
    };
  }

  const result = (data ?? {}) as IssueRpcResult;
  if (!result.ok) {
    return {
      error: result.error || "Could not mark the revision as issued.",
      providerAccepted: input.provider === "resend",
      unknownOutcome: true,
    };
  }

  // Issue + matching claim finalisation already happen inside
  // issue_proposal_revision (same DB transaction). Do not clear
  // issue_send_claim_* here — a later app update could wipe a newer claim.

  revalidateIssuePaths(input.proposalId);
  return {
    ok: true,
    simulated: input.provider === "simulated",
    alreadyIssued: Boolean(result.already_issued),
    previousTotalPence: result.previous_total_amount,
    newTotalPence: result.new_total_amount,
    revisionNumber: result.content_revision,
    messageId: result.message_id || input.messageId,
    providerAccepted: true,
  };
}

/**
 * Explicit simulated issue — never calls Resend.
 * Only available when local/dev testing is enabled.
 */
export async function simulateIssueRevisedProposal(
  _prev: IssueRevisedProposalState,
  formData: FormData
): Promise<IssueRevisedProposalState> {
  if (!isDevTestingEnabled()) {
    return { error: devTestingDisabledMessage() };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding first." };
  }

  const proposalId = getString(formData, "proposalId");
  const expectedContentRevision = Number.parseInt(
    getString(formData, "expectedContentRevision"),
    10
  );
  if (!proposalId || !Number.isFinite(expectedContentRevision)) {
    return { error: "Missing proposal revision details. Refresh and try again." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select(
      "id, status, workspace_id, content_revision, unsent_revision_at, total_amount, scope_of_work, job_summary, issue_attempt_message_id, issue_attempt_content_revision"
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  if (
    !canIssueRevisedProposal({
      status: normalizeProposalStatus(proposal.status),
      unsent_revision_at: proposal.unsent_revision_at,
      content_revision: proposal.content_revision,
      total_amount: proposal.total_amount,
    })
  ) {
    return {
      error:
        "No saved unsent revision is ready to issue. Save a revision first.",
    };
  }

  if (proposal.content_revision !== expectedContentRevision) {
    return {
      error: "This proposal was updated elsewhere. Refresh and try again.",
    };
  }

  // Uncertain prior attempt for this revision — do not invent a second send.
  const priorAttemptRevision = Number(
    proposal.issue_attempt_content_revision ?? NaN
  );
  if (
    proposal.issue_attempt_message_id &&
    priorAttemptRevision === expectedContentRevision
  ) {
    return {
      error:
        "A previous issue attempt for this revision is still unsettled. Use Confirm issue without resending instead of sending again.",
      unknownOutcome: true,
      messageId: String(proposal.issue_attempt_message_id),
    };
  }

  if (!String(proposal.scope_of_work || proposal.job_summary || "").trim()) {
    return { error: "Add scope or a job summary before issuing." };
  }

  const claimKey = buildIssueSendClaimKey(proposalId, expectedContentRevision);
  const claimed = await claimIssueSend(supabase, {
    proposalId,
    expectedContentRevision,
    claimKey,
  });
  if (!claimed.ok) {
    return {
      error: claimed.error,
      claimHeld: claimed.claimHeld,
    };
  }
  // Same claim key reclaim must not silently send again after an unknown outcome.
  if (claimed.alreadyClaimed) {
    return {
      error:
        "An issue attempt for this revision is already in progress or unsettled. Refresh and use Confirm issue without resending if a provider message id is stored.",
      claimHeld: true,
      unknownOutcome: true,
    };
  }

  // Prove PDF can be generated for the revised live totals before marking issued.
  const pdfContext = await loadProposalPdfContext(
    supabase,
    proposalId,
    user.id
  );
  if (!pdfContext.ok) {
    return { error: pdfContext.error };
  }
  try {
    await generateFreshProposalPdfBuffer(
      pdfContext.proposal,
      pdfContext.workspace
    );
  } catch {
    return {
      error: "Could not generate the revised proposal PDF. Please try again.",
    };
  }

  await ensureProposalCustomerAccessToken(supabase, proposalId);

  const messageId = `simulated-revision-${randomUUID()}`;
  const attempt = await recordIssueAttempt(supabase, {
    proposalId,
    expectedContentRevision,
    provider: "simulated",
    messageId,
  });
  if (!attempt.ok) {
    return {
      error: attempt.error,
      unknownOutcome: true,
      messageId,
    };
  }

  return finalizeIssue(supabase, {
    proposalId,
    expectedContentRevision,
    provider: "simulated",
    messageId,
    claimKey,
  });
}

/**
 * Provider email issue path. Claims the revision BEFORE sending.
 * Does not clear unsent_revision_at unless the provider accepts the send
 * AND the issue RPC succeeds afterwards.
 */
export async function issueRevisedProposalByEmail(
  _prev: IssueRevisedProposalState,
  formData: FormData
): Promise<IssueRevisedProposalState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding first." };
  }

  const proposalId = getString(formData, "proposalId");
  const expectedContentRevision = Number.parseInt(
    getString(formData, "expectedContentRevision"),
    10
  );
  if (!proposalId || !Number.isFinite(expectedContentRevision)) {
    return { error: "Missing proposal revision details. Refresh and try again." };
  }

  if (!process.env.RESEND_API_KEY?.trim()) {
    return {
      error:
        "Email sending is not configured. Use the labelled test issue action in local/dev testing, or add RESEND_API_KEY.",
    };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select(
      "id, status, content_revision, unsent_revision_at, total_amount, scope_of_work, job_summary, issue_attempt_message_id, issue_attempt_content_revision"
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  if (
    !canIssueRevisedProposal({
      status: normalizeProposalStatus(proposal.status),
      unsent_revision_at: proposal.unsent_revision_at,
      content_revision: proposal.content_revision,
      total_amount: proposal.total_amount,
    })
  ) {
    return {
      error:
        "No saved unsent revision is ready to issue. Save a revision first.",
    };
  }

  if (proposal.content_revision !== expectedContentRevision) {
    return {
      error: "This proposal was updated elsewhere. Refresh and try again.",
    };
  }

  const priorAttemptRevision = Number(
    proposal.issue_attempt_content_revision ?? NaN
  );
  if (
    proposal.issue_attempt_message_id &&
    priorAttemptRevision === expectedContentRevision
  ) {
    return {
      error:
        "A previous issue attempt for this revision is still unsettled. Do not resend. Use Confirm issue without resending.",
      unknownOutcome: true,
      providerAccepted: true,
      messageId: String(proposal.issue_attempt_message_id),
    };
  }

  const claimKey = buildIssueSendClaimKey(proposalId, expectedContentRevision);
  const claimed = await claimIssueSend(supabase, {
    proposalId,
    expectedContentRevision,
    claimKey,
  });
  if (!claimed.ok) {
    return {
      error: claimed.error,
      claimHeld: claimed.claimHeld,
    };
  }
  if (claimed.alreadyClaimed) {
    return {
      error:
        "An issue attempt for this revision is already in progress or unsettled. Do not resend. Refresh and use Confirm issue without resending if a provider message id is stored.",
      claimHeld: true,
      unknownOutcome: true,
      providerAccepted: Boolean(proposal.issue_attempt_message_id),
      messageId: proposal.issue_attempt_message_id
        ? String(proposal.issue_attempt_message_id)
        : undefined,
    };
  }

  const sendResult = await sendProposalToCustomer(supabase, {
    proposalId,
    userId: user.id,
    userEmail: user.email,
    kind: "revised",
    // Keep unsent_revision_at until issue RPC confirms local state.
    deferLifecycleUpdate: true,
    idempotencyKey: claimKey,
  });

  if (!sendResult.ok) {
    // Leave claim in place briefly so a twin click cannot race a second send.
    return { error: sendResult.error, providerAccepted: false };
  }

  // Persist attempt BEFORE finalize. Zero-row updates must be detected.
  const attempt = await recordIssueAttempt(supabase, {
    proposalId,
    expectedContentRevision,
    provider: "resend",
    messageId: sendResult.messageId,
  });

  if (!attempt.ok) {
    return {
      ok: false,
      providerAccepted: true,
      messageId: sendResult.messageId,
      unknownOutcome: true,
      error:
        attempt.error ||
        "The email provider accepted the message, but Reanvil could not store the issue attempt. Do not resend. Note the provider message id: " +
          sendResult.messageId,
    };
  }

  const finalized = await finalizeIssue(supabase, {
    proposalId,
    expectedContentRevision,
    provider: "resend",
    messageId: sendResult.messageId,
    claimKey,
  });

  if (!finalized.ok) {
    return {
      ...finalized,
      providerAccepted: true,
      messageId: sendResult.messageId,
      unknownOutcome: true,
      error:
        finalized.error ||
        "The email provider accepted the message, but Reanvil could not mark the revision issued. Do not resend yet — use Confirm issue without resending.",
    };
  }

  return finalized;
}

/**
 * Trader-only: mark a revision issued using a stored provider message id
 * without sending another email. Use after provider-accept + RPC failure.
 */
export async function confirmIssueWithoutResending(
  _prev: IssueRevisedProposalState,
  formData: FormData
): Promise<IssueRevisedProposalState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding first." };
  }

  const proposalId = getString(formData, "proposalId");
  const expectedContentRevision = Number.parseInt(
    getString(formData, "expectedContentRevision"),
    10
  );
  if (!proposalId || !Number.isFinite(expectedContentRevision)) {
    return { error: "Missing proposal revision details. Refresh and try again." };
  }

  const { data: proposal, error: loadError } = await supabase
    .from("proposals")
    .select(
      "id, status, content_revision, unsent_revision_at, issue_attempt_message_id, issue_attempt_provider, issue_attempt_content_revision, total_amount"
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (loadError || !proposal) {
    return { error: "Proposal not found." };
  }

  if (!proposal.unsent_revision_at) {
    return { error: "No unsent revision is waiting to be confirmed." };
  }

  if (proposal.content_revision !== expectedContentRevision) {
    return {
      error: "This proposal was updated elsewhere. Refresh and try again.",
    };
  }

  const attemptRevision = Number(proposal.issue_attempt_content_revision ?? NaN);
  if (
    !Number.isFinite(attemptRevision) ||
    attemptRevision !== expectedContentRevision
  ) {
    return {
      error:
        "The stored provider attempt belongs to a different revision. Do not confirm this issue — refresh and review before sending again.",
    };
  }

  const messageId = String(proposal.issue_attempt_message_id || "").trim();
  if (!messageId) {
    return {
      error:
        "No provider message id is stored for this revision. Check email history before retrying.",
    };
  }

  const provider =
    proposal.issue_attempt_provider === "simulated" ? "simulated" : "resend";

  return finalizeIssue(supabase, {
    proposalId,
    expectedContentRevision,
    provider,
    messageId,
    claimKey: buildIssueSendClaimKey(proposalId, expectedContentRevision),
  });
}
