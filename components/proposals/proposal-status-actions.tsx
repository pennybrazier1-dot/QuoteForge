"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateProposalStatus,
  type UpdateProposalStatusState,
} from "@/app/proposals/status-actions";
import { AuthError } from "@/components/auth/auth-shell";
import {
  isProposalStatus,
  normalizeProposalStatus,
  type ProposalStatus,
} from "@/lib/proposals/status";

const initialState: UpdateProposalStatusState = {};

function StatusActionButton({
  label,
  pendingLabel,
  variant = "secondary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "success" | "danger";
}) {
  const { pending } = useFormStatus();

  const classes = {
    primary:
      "bg-accent text-black hover:bg-accent-hover",
    secondary:
      "border border-border-subtle bg-white/5 text-foreground hover:bg-white/10",
    success:
      "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
    danger:
      "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function StatusTransitionForm({
  formAction,
  proposalId,
  newStatus,
  label,
  pendingLabel,
  variant = "secondary",
}: {
  formAction: (payload: FormData) => void;
  proposalId: string;
  newStatus: ProposalStatus;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "success" | "danger";
}) {
  return (
    <form action={formAction}>
      <input type="hidden" name="proposalId" value={proposalId} />
      <input type="hidden" name="newStatus" value={newStatus} />
      <StatusActionButton
        label={label}
        pendingLabel={pendingLabel}
        variant={variant}
      />
    </form>
  );
}

function ActionLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center rounded-full border border-border-subtle bg-white/5 px-4 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
    >
      {label}
    </Link>
  );
}

function PdfDownloadLink({
  proposalId,
  proposalNumber,
}: {
  proposalId: string;
  proposalNumber: string;
}) {
  return (
    <a
      href={`/proposals/${proposalId}/pdf`}
      download={`${proposalNumber.replace(/\s+/g, "-")}.pdf`}
      className="inline-flex h-9 items-center justify-center rounded-full border border-accent/40 bg-accent-soft px-4 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
    >
      Download PDF
    </a>
  );
}

type ProposalStatusActionsProps = {
  proposalId: string;
  proposalNumber: string;
  status: string;
};

export function ProposalStatusActions({
  proposalId,
  proposalNumber,
  status,
}: ProposalStatusActionsProps) {
  const [state, formAction] = useActionState(updateProposalStatus, initialState);

  if (!isProposalStatus(status)) {
    return null;
  }

  const normalized = normalizeProposalStatus(status);

  return (
    <div className="space-y-4">
      {state.error ? <AuthError message={state.error} /> : null}

      <div className="flex flex-wrap gap-3">
        {normalized === "draft" ? (
          <>
            <ActionLink
              href={`/proposals/${proposalId}/edit`}
              label="Edit Draft"
            />
            <ActionLink
              href={`/proposals/${proposalId}/edit`}
              label="Accept AI Draft"
            />
            <StatusTransitionForm
              formAction={formAction}
              proposalId={proposalId}
              newStatus="ready_to_send"
              label="Mark Ready to Send"
              pendingLabel="Updating…"
              variant="primary"
            />
          </>
        ) : null}

        {normalized === "ready_to_send" ? (
          <>
            <PdfDownloadLink
              proposalId={proposalId}
              proposalNumber={proposalNumber}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
