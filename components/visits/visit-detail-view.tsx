"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
import { SectionCard } from "@/components/ui/section-card";
import {
  completeVisitAction,
  startQuoteFromVisitAction,
  updateVisitNotesAction,
  type VisitActionState,
} from "@/lib/visits/actions";
import {
  formatVisitAddress,
  formatVisitDateLabel,
  formatVisitDuration,
  formatVisitStatus,
  formatVisitTimeLabel,
  formatVisitType,
  type VisitRecord,
} from "@/lib/visits/types";

const notesInitialState: VisitActionState = {};
const quoteInitialState: VisitActionState = {};
const completeInitialState: VisitActionState = {};

function SaveNotesButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-secondary" disabled={pending}>
      {pending ? "Saving…" : "Save notes"}
    </button>
  );
}

function CreateQuoteButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="qf-btn-primary"
      disabled={disabled || pending}
    >
      {pending ? "Opening quote…" : "Create quote from notes"}
    </button>
  );
}

function CompleteVisitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="qf-btn-secondary"
      disabled={disabled || pending}
    >
      {pending ? "Completing…" : "Complete visit"}
    </button>
  );
}

function DetailField({
  label,
  id,
  value,
}: {
  label: string;
  id: string;
  value: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="qf-field-label">
        {label}
      </label>
      <input
        id={id}
        className="form-input mt-2"
        value={value}
        readOnly
        tabIndex={-1}
      />
    </div>
  );
}

export function VisitDetailView({
  visit,
  linkedProposal,
}: {
  visit: VisitRecord;
  linkedProposal?: { id: string; proposal_number: string | null } | null;
}) {
  const [notesState, notesAction] = useActionState(
    updateVisitNotesAction,
    notesInitialState
  );
  const [quoteState, quoteAction] = useActionState(
    startQuoteFromVisitAction,
    quoteInitialState
  );
  const [completeState, completeAction] = useActionState(
    completeVisitAction,
    completeInitialState
  );
  const [notes, setNotes] = useState(visit.notes);

  const address = formatVisitAddress(visit);
  const timeLabel = formatVisitTimeLabel(visit.visit_time);
  const visitWhen = [
    formatVisitDateLabel(visit.visit_date),
    timeLabel,
    formatVisitDuration(visit.duration_minutes),
  ]
    .filter(Boolean)
    .join(" · ");
  const isCompleted = visit.status === "completed" || completeState.ok;
  const canCreateQuote = Boolean(
    notes.trim() || visit.enquiry_summary.trim()
  );
  const proposal = linkedProposal?.id
    ? linkedProposal
    : visit.linked_proposal_id
      ? { id: visit.linked_proposal_id, proposal_number: null }
      : null;

  return (
    <div className="qf-proposal-page qf-mobile-safe">
      <header className="qf-proposal-header">
        <Link
          href="/visits"
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          ← Back to visits
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {formatVisitType(visit.visit_type)}
            </p>
            <h1 className="qf-proposal-title mt-1">{visit.customer_name}</h1>
            <p className="qf-proposal-subtitle">{visitWhen}</p>
          </div>
          <span
            className={`qf-visit-status qf-visit-status-${isCompleted ? "completed" : visit.status}`}
          >
            {formatVisitStatus(isCompleted ? "completed" : visit.status)}
          </span>
        </div>
      </header>

      <div className="qf-proposal-col-left">
        <SectionCard className="qf-card-form">
          <h2 className="qf-card-heading">Customer details</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <DetailField
              label="Name"
              id="visitCustomerName"
              value={visit.customer_name}
            />
            <DetailField
              label="Email"
              id="visitEmail"
              value={visit.contact_email || "Not provided"}
            />
            <DetailField
              label="Phone"
              id="visitPhone"
              value={visit.contact_phone || "Not provided"}
            />
            <DetailField
              label="Address"
              id="visitAddress"
              value={address || "Not provided"}
            />
            <div className="sm:col-span-2">
              <DetailField
                label="Visit date / time"
                id="visitWhen"
                value={visitWhen}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard className="qf-card-form qf-qq-prep-card">
          <div className="qf-qq-prep-head">
            <div>
              <h2 className="qf-card-heading">Visit notes</h2>
              <p className="qf-body-text mt-1 text-muted">
                Write what you found on site. When you create a quote, these
                notes become the job notes and AI organises the draft.
              </p>
            </div>
          </div>

          <form action={notesAction} className="mt-5">
            <input type="hidden" name="visitId" value={visit.id} />
            <div className="qf-textarea-wrap">
              <label htmlFor="visit-notes" className="qf-field-label">
                What did you find?
              </label>
              <textarea
                id="visit-notes"
                className="form-textarea qf-site-notes-textarea mt-2"
                name="notes"
                rows={14}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Write what you found during the visit..."
              />
            </div>
            {notesState.error ? (
              <div className="mt-4">
                <AuthError message={notesState.error} />
              </div>
            ) : null}
            {notesState.ok ? (
              <p className="qf-body-text mt-3 text-muted" role="status">
                Notes saved.
              </p>
            ) : null}
            <div className="mt-4">
              <SaveNotesButton />
            </div>
          </form>
        </SectionCard>

        <SectionCard className="qf-card-form">
          <h2 className="qf-card-heading">Actions</h2>
          <p className="qf-body-text mt-2 text-muted">
            Start a quote from these notes. You can review and edit before
            sending.
          </p>
          <form action={quoteAction} className="mt-5 space-y-3">
            <input type="hidden" name="visitId" value={visit.id} />
            <input type="hidden" name="notes" value={notes} />
            {quoteState.error ? (
              <AuthError message={quoteState.error} />
            ) : null}
            <CreateQuoteButton disabled={!canCreateQuote} />
          </form>
          {visit.customer_id ? (
            <div className="mt-3">
              <Link
                href={`/customers/${visit.customer_id}`}
                className="qf-btn-secondary"
              >
                View customer
              </Link>
            </div>
          ) : null}
          {visit.enquiry_id ? (
            <div className="mt-3">
              <Link
                href={`/enquiries/${visit.enquiry_id}`}
                className="qf-btn-secondary"
              >
                View enquiry
              </Link>
            </div>
          ) : null}
        </SectionCard>

        {proposal ? (
          <SectionCard className="qf-card-form">
            <h2 className="qf-card-heading">Linked quote</h2>
            <p className="qf-body-text mt-2 text-muted">
              A quote was started from this visit.
            </p>
            <div className="mt-5">
              <Link
                href={`/proposals/${proposal.id}`}
                className="qf-btn-primary"
              >
                {proposal.proposal_number
                  ? `Open ${proposal.proposal_number}`
                  : "Open quote"}
              </Link>
            </div>
          </SectionCard>
        ) : null}

        <SectionCard className="qf-card-form">
          <h2 className="qf-card-heading">Complete visit</h2>
          <p className="qf-body-text mt-2 text-muted">
            Mark this visit as done when you have finished on site.
          </p>
          {isCompleted ? (
            <p className="qf-body-text mt-4" role="status">
              This visit is marked complete.
            </p>
          ) : (
            <form action={completeAction} className="mt-5 space-y-3">
              <input type="hidden" name="visitId" value={visit.id} />
              <input type="hidden" name="notes" value={notes} />
              {completeState.error ? (
                <AuthError message={completeState.error} />
              ) : null}
              <CompleteVisitButton />
            </form>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
