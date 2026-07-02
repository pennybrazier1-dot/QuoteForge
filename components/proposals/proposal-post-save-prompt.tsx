"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSendProposalDialog } from "@/components/proposals/send-proposal-provider";

type ProposalPostSavePromptProps = {
  proposalId: string;
  canPreviewPdf: boolean;
  canSend: boolean;
  sendDisabledReason: string | null;
};

export function ProposalPostSavePrompt({
  proposalId,
  canPreviewPdf,
  canSend,
  sendDisabledReason,
}: ProposalPostSavePromptProps) {
  const router = useRouter();
  const { openSendDialog } = useSendProposalDialog();

  function dismissPrompt() {
    router.replace(`/proposals/${proposalId}`, { scroll: false });
  }

  function handleSendClick() {
    if (!canSend) {
      return;
    }

    openSendDialog();
    dismissPrompt();
  }

  return (
    <section
      className="qf-post-save-prompt"
      aria-labelledby="qf-post-save-heading"
    >
      <div className="qf-post-save-prompt-header">
        <h2 id="qf-post-save-heading" className="qf-post-save-prompt-title">
          What do you want to do with this proposal now?
        </h2>
        <button
          type="button"
          className="qf-post-save-prompt-dismiss"
          onClick={dismissPrompt}
        >
          Dismiss
        </button>
      </div>

      {canSend ? (
        <button
          type="button"
          className="qf-post-save-prompt-primary"
          onClick={handleSendClick}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
          Send to Customer
        </button>
      ) : (
        <div className="qf-post-save-prompt-primary-block">
          <span
            className="qf-post-save-prompt-primary qf-post-save-prompt-primary-disabled"
            aria-disabled="true"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
            Send to Customer
          </span>
          {sendDisabledReason ? (
            <p className="qf-post-save-prompt-hint">{sendDisabledReason}</p>
          ) : null}
        </div>
      )}

      <div className="qf-post-save-prompt-secondary">
        {canPreviewPdf ? (
          <a
            href={`/proposals/${proposalId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="qf-post-save-prompt-secondary-btn"
            onClick={dismissPrompt}
          >
            PDF
          </a>
        ) : (
          <span
            className="qf-post-save-prompt-secondary-btn qf-post-save-prompt-secondary-btn-disabled"
            aria-disabled="true"
          >
            PDF
          </span>
        )}
        <Link
          href={`/proposals/${proposalId}/edit`}
          className="qf-post-save-prompt-secondary-btn"
          onClick={dismissPrompt}
        >
          Edit
        </Link>
      </div>
    </section>
  );
}
