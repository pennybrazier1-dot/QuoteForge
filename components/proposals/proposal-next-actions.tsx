"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateProposalStatus,
  type UpdateProposalStatusState,
} from "@/app/proposals/status-actions";
import { AuthError } from "@/components/auth/auth-shell";
import {
  isProposalStatus,
  type ProposalStatus,
} from "@/lib/proposals/status";

export type NextActionsProposal = {
  id: string;
  proposal_number: string;
  status: string;
  customer_id: string | null;
  hasStructured: boolean;
};

type NextAction = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  tone: "accent" | "blue" | "emerald" | "amber" | "purple" | "muted";
  primary?: boolean;
  disabled?: boolean;
  href?: string;
  external?: boolean;
  download?: boolean;
  sendStatus?: ProposalStatus;
};

const initialState: UpdateProposalStatusState = {};

const ICONS = {
  sparkle: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.9 5.8H4l4.9 3.6-1.9 5.8L12 14.6l5 3.8-1.9-5.8L20 8.8h-6.1L12 3z" />
    </svg>
  ),
  edit: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  preview: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  ),
  download: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  ),
  send: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  ),
  timeline: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  reminder: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  customer: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  duplicate: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  ),
  job: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </svg>
  ),
} as const;

function pdfHref(proposalId: string): string {
  return `/proposals/${proposalId}/pdf`;
}

function buildNextActions(proposal: NextActionsProposal): NextAction[] {
  const { id, proposal_number, status, customer_id, hasStructured } = proposal;
  const pdfPreview = {
    id: "preview-pdf",
    title: "Preview PDF",
    description: "View the customer version of this proposal.",
    icon: ICONS.preview,
    tone: "blue" as const,
    href: pdfHref(id),
    external: true,
  };
  const downloadPdf = {
    id: "download-pdf",
    title: "Download PDF",
    description: "Save a copy of the proposal PDF.",
    icon: ICONS.download,
    tone: "blue" as const,
    href: pdfHref(id),
    download: true,
  };
  const openPdf = {
    id: "open-pdf",
    title: "Open PDF",
    description: "View the customer version of this proposal.",
    icon: ICONS.preview,
    tone: "blue" as const,
    href: pdfHref(id),
    external: true,
  };
  const editProposal = {
    id: "edit-proposal",
    title: "Edit Proposal",
    description: "Update site notes, customer details, or your estimate.",
    icon: ICONS.edit,
    tone: "amber" as const,
    href: `/proposals/${id}/edit`,
  };
  const viewCustomer = {
    id: "view-customer",
    title: "View Customer",
    description: customer_id
      ? "Open the customer record."
      : "Browse your customer records.",
    icon: ICONS.customer,
    tone: "emerald" as const,
    href: customer_id ? `/customers/${customer_id}` : "/customers",
  };
  const duplicateProposal = {
    id: "duplicate-proposal",
    title: "Duplicate Proposal",
    description: "Create a copy of this proposal.",
    icon: ICONS.duplicate,
    tone: "purple" as const,
    href: "/proposals/new",
  };
  const sendReminder = {
    id: "send-reminder",
    title: "Send Reminder",
    description: "Coming soon — follow up with the customer.",
    icon: ICONS.reminder,
    tone: "amber" as const,
    disabled: true,
  };
  const convertToJob = {
    id: "convert-to-job",
    title: "Convert to Job",
    description: "Coming soon — turn this win into a job.",
    icon: ICONS.job,
    tone: "muted" as const,
    disabled: true,
  };

  if (!isProposalStatus(status)) {
    return hasStructured ? [openPdf] : [];
  }

  switch (status) {
    case "draft": {
      const actions: NextAction[] = [];

      if (!hasStructured) {
        actions.push({
          id: "generate-ai",
          title: "Generate AI Proposal",
          description: "Turn your site notes into a professional proposal.",
          icon: ICONS.sparkle,
          tone: "accent",
          primary: true,
          href: `/proposals/${id}/edit`,
        });
      }

      actions.push(editProposal);

      if (hasStructured) {
        actions.push(pdfPreview, downloadPdf);
      }

      return actions;
    }

    case "ready_to_send":
      return [
        {
          id: "send-proposal",
          title: "Send Proposal",
          description: "Email this proposal to the customer.",
          icon: ICONS.send,
          tone: "accent",
          primary: true,
          sendStatus: "sent",
        },
        pdfPreview,
        downloadPdf,
        editProposal,
      ];

    case "sent":
      return [
        {
          id: "view-timeline",
          title: "View Timeline",
          description: "See what has happened with this proposal so far.",
          icon: ICONS.timeline,
          tone: "accent",
          primary: true,
          href: "#proposal-timeline",
        },
        openPdf,
        sendReminder,
        viewCustomer,
      ];

    case "accepted":
      return [
        { ...viewCustomer, primary: true },
        openPdf,
        duplicateProposal,
        convertToJob,
      ];

    case "declined":
      return [
        { ...duplicateProposal, primary: true },
        viewCustomer,
        openPdf,
      ];

    case "expired":
      return [viewCustomer, openPdf, duplicateProposal];

    default:
      return [];
  }
}

function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="qf-workspace-next-chevron"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ActionRowContent({ action }: { action: NextAction }) {
  return (
    <>
      <span
        className={`qf-workspace-next-icon qf-workspace-next-icon-${action.tone}`}
      >
        {action.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="qf-workspace-next-title">{action.title}</p>
        <p className="qf-workspace-next-description">{action.description}</p>
      </div>
      {!action.disabled ? <Chevron /> : null}
    </>
  );
}

function SendActionRow({
  action,
  proposalId,
  formAction,
}: {
  action: NextAction;
  proposalId: string;
  formAction: (payload: FormData) => void;
}) {
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className="qf-workspace-next-form">
      <input type="hidden" name="proposalId" value={proposalId} />
      <input type="hidden" name="newStatus" value={action.sendStatus} />
      <button
        type="submit"
        disabled={pending}
        className={`qf-workspace-next-row ${
          action.primary ? "qf-workspace-next-row-primary" : ""
        }`}
      >
        <span
          className={`qf-workspace-next-icon qf-workspace-next-icon-${action.tone}`}
        >
          {action.icon}
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className="qf-workspace-next-title">
            {pending ? "Sending…" : action.title}
          </p>
          <p className="qf-workspace-next-description">{action.description}</p>
        </div>
        <Chevron />
      </button>
    </form>
  );
}

function NextActionRow({
  action,
  proposalId,
  proposalNumber,
  formAction,
}: {
  action: NextAction;
  proposalId: string;
  proposalNumber: string;
  formAction: (payload: FormData) => void;
}) {
  const rowClass = `qf-workspace-next-row ${
    action.primary ? "qf-workspace-next-row-primary" : ""
  }`;

  if (action.sendStatus) {
    return (
      <li>
        <SendActionRow
          action={action}
          proposalId={proposalId}
          formAction={formAction}
        />
      </li>
    );
  }

  if (action.disabled) {
    return (
      <li>
        <div className={`${rowClass} qf-workspace-next-row-disabled`}>
          <ActionRowContent action={action} />
        </div>
      </li>
    );
  }

  if (action.href) {
    const linkProps = action.external
      ? { target: "_blank" as const, rel: "noopener noreferrer" }
      : {};

    if (action.download) {
      return (
        <li>
          <a
            href={action.href}
            download={`${proposalNumber.replace(/\s+/g, "-")}.pdf`}
            className={rowClass}
          >
            <ActionRowContent action={action} />
          </a>
        </li>
      );
    }

    return (
      <li>
        <Link href={action.href} className={rowClass} {...linkProps}>
          <ActionRowContent action={action} />
        </Link>
      </li>
    );
  }

  return null;
}

export function ProposalNextActions({
  proposal,
}: {
  proposal: NextActionsProposal;
}) {
  const [state, formAction] = useActionState(updateProposalStatus, initialState);
  const actions = buildNextActions(proposal);

  if (actions.length === 0) {
    return (
      <p className="qf-body-text text-muted">
        No actions available for this proposal right now.
      </p>
    );
  }

  return (
    <div className="qf-workspace-next-actions">
      {state.error ? <AuthError message={state.error} /> : null}
      <ul className="qf-workspace-next-list">
        {actions.map((action) => (
          <NextActionRow
            key={action.id}
            action={action}
            proposalId={proposal.id}
            proposalNumber={proposal.proposal_number}
            formAction={formAction}
          />
        ))}
      </ul>
    </div>
  );
}
