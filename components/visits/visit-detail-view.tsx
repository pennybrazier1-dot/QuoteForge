"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
import { ProposalConfirmDialog } from "@/components/proposals/proposal-confirm-dialog";
import { SectionCard } from "@/components/ui/section-card";
import { buildSiteVisitModePath } from "@/lib/enquiries/site-visit-mode-link";
import {
  cancelVisitAction,
  completeVisitAction,
  rescheduleVisitAction,
  startQuoteFromVisitAction,
  updateVisitNotesAction,
  type VisitActionState,
} from "@/lib/visits/actions";
import { buildCustomerVisitConfirmationUrl } from "@/lib/visits/customer-confirmation/token";
import {
  canCancelVisit,
  canRescheduleVisit,
} from "@/lib/visits/lifecycle";
import {
  VISIT_TIME_OPTIONS,
  formatVisitAddress,
  formatVisitDateLabel,
  formatVisitDuration,
  formatVisitStatus,
  formatVisitTimeLabel,
  formatVisitType,
  type VisitRecord,
  type VisitStatus,
} from "@/lib/visits/types";

const notesInitialState: VisitActionState = {};
const quoteInitialState: VisitActionState = {};
const completeInitialState: VisitActionState = {};
const rescheduleInitialState: VisitActionState = {};
const cancelInitialState: VisitActionState = {};

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

function RescheduleButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="qf-btn-primary"
      disabled={disabled || pending}
    >
      {pending ? "Saving new time…" : "Save new date and time"}
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
  const router = useRouter();
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
  const [rescheduleState, rescheduleAction] = useActionState(
    rescheduleVisitAction,
    rescheduleInitialState
  );
  const [cancelState, cancelAction] = useActionState(
    cancelVisitAction,
    cancelInitialState
  );
  const [notes, setNotes] = useState(visit.notes);
  const [rescheduleDate, setRescheduleDate] = useState(visit.visit_date);
  const [rescheduleTime, setRescheduleTime] = useState(visit.visit_time ?? "");
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    if (rescheduleState.ok || cancelState.ok || completeState.ok) {
      router.refresh();
    }
  }, [rescheduleState.ok, cancelState.ok, completeState.ok, router]);

  const displayStatus: VisitStatus = cancelState.ok
    ? "cancelled"
    : completeState.ok
      ? "completed"
      : visit.status;

  const address = formatVisitAddress(visit);
  const timeLabel = formatVisitTimeLabel(
    rescheduleState.ok ? rescheduleTime || null : visit.visit_time
  );
  const displayDate = rescheduleState.ok ? rescheduleDate : visit.visit_date;
  const visitWhen = [
    formatVisitDateLabel(displayDate),
    timeLabel,
    formatVisitDuration(visit.duration_minutes),
  ]
    .filter(Boolean)
    .join(" · ");
  const isCompleted = displayStatus === "completed";
  const isCancelled = displayStatus === "cancelled";
  const allowReschedule = canRescheduleVisit(displayStatus);
  const allowCancel = canCancelVisit(displayStatus);
  const canCreateQuote = Boolean(
    notes.trim() || visit.enquiry_summary.trim()
  );
  const proposal = linkedProposal?.id
    ? linkedProposal
    : visit.linked_proposal_id
      ? { id: visit.linked_proposal_id, proposal_number: null }
      : null;

  return (
    <div className="qf-trader-page qf-proposal-page qf-mobile-safe">
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
          <span className={`qf-visit-status qf-visit-status-${displayStatus}`}>
            {formatVisitStatus(displayStatus)}
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

        {visit.customer_access_token ? (
          <SectionCard className="qf-card-form">
            <h2 className="qf-card-heading">Customer confirmation</h2>
            <p className="qf-body-text mt-2 text-muted">
              Secure link that works on any device. It shows visit date, time
              and address only — not your private notes.
            </p>
            <p className="qf-body-text mt-3 break-all">
              {buildCustomerVisitConfirmationUrl(visit.customer_access_token)}
            </p>
            {visit.enquiry_id && !isCancelled ? (
              <div className="mt-4">
                <Link
                  href={buildSiteVisitModePath(visit.enquiry_id, visit.id)}
                  className="qf-btn-secondary"
                >
                  Open Site Visit Mode
                </Link>
              </div>
            ) : null}
          </SectionCard>
        ) : null}

        {allowReschedule ? (
          <SectionCard className="qf-card-form">
            <h2 className="qf-card-heading">Reschedule visit</h2>
            <p className="qf-body-text mt-2 text-muted">
              Change the appointment time on this visit. The same confirmation
              link stays valid for the customer.
            </p>
            <form action={rescheduleAction} className="mt-5 space-y-4">
              <input type="hidden" name="visitId" value={visit.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="rescheduleDate" className="qf-field-label">
                    New date
                  </label>
                  <input
                    id="rescheduleDate"
                    name="visitDate"
                    type="date"
                    className="form-input mt-2"
                    value={rescheduleDate}
                    onChange={(event) => setRescheduleDate(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="rescheduleTime" className="qf-field-label">
                    New time
                  </label>
                  <select
                    id="rescheduleTime"
                    name="visitTime"
                    className="form-input mt-2"
                    value={rescheduleTime}
                    onChange={(event) => setRescheduleTime(event.target.value)}
                  >
                    <option value="">Time TBC</option>
                    {VISIT_TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {formatVisitTimeLabel(time)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {rescheduleState.error ? (
                <AuthError message={rescheduleState.error} />
              ) : null}
              {rescheduleState.ok && rescheduleState.notice ? (
                <p className="qf-body-text text-muted" role="status">
                  {rescheduleState.notice}
                </p>
              ) : null}
              <RescheduleButton />
            </form>
          </SectionCard>
        ) : null}

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
            <CreateQuoteButton disabled={!canCreateQuote || isCancelled} />
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

        {!isCancelled ? (
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
        ) : null}

        <SectionCard className="qf-card-form">
          <h2 className="qf-card-heading">Cancel visit</h2>
          {isCancelled ? (
            <p className="qf-body-text mt-2" role="status">
              This visit is cancelled. Capture notes and photos are kept. The
              customer confirmation link still opens and shows cancelled.
            </p>
          ) : allowCancel ? (
            <>
              <p className="qf-body-text mt-2 text-muted">
                Cancels this appointment without deleting notes or photos. The
                customer is not emailed automatically.
              </p>
              {cancelState.error ? (
                <div className="mt-4">
                  <AuthError message={cancelState.error} />
                </div>
              ) : null}
              {cancelState.ok && cancelState.notice ? (
                <p className="qf-body-text mt-3 text-muted" role="status">
                  {cancelState.notice}
                </p>
              ) : null}
              <div className="mt-5">
                <button
                  type="button"
                  className="qf-btn-secondary"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel visit
                </button>
              </div>
              <form id="cancel-visit-form" action={cancelAction} className="hidden">
                <input type="hidden" name="visitId" value={visit.id} />
                <input type="hidden" name="confirmCancel" value="1" />
              </form>
            </>
          ) : (
            <p className="qf-body-text mt-2 text-muted">
              This visit can no longer be cancelled.
            </p>
          )}
        </SectionCard>
      </div>

      <ProposalConfirmDialog
        open={cancelOpen}
        title="Cancel this visit?"
        description="The appointment will be cancelled. Notes and photos stay saved. The customer will not be emailed automatically."
        confirmLabel="Cancel visit"
        destructive
        onClose={() => setCancelOpen(false)}
        onConfirm={() => {
          const form = document.getElementById(
            "cancel-visit-form"
          ) as HTMLFormElement | null;
          form?.requestSubmit();
          setCancelOpen(false);
        }}
      />
    </div>
  );
}
