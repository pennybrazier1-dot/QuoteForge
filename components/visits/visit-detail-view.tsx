"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
import { SectionCard } from "@/components/ui/section-card";
import {
  organiseVisitNotesAction,
  updateVisitNotesAction,
  updateVisitStatusAction,
  type OrganiseVisitNotesState,
  type VisitActionState,
} from "@/lib/visits/actions";
import { VISIT_NOTES_ORGANISED_FIELDS } from "@/lib/visits/organise-visit-notes";
import {
  VISIT_STATUSES,
  formatVisitAddress,
  formatVisitDateLabel,
  formatVisitDuration,
  formatVisitStatus,
  formatVisitTimeLabel,
  formatVisitType,
  type VisitRecord,
} from "@/lib/visits/types";

const notesInitialState: VisitActionState = {};
const organiseInitialState: OrganiseVisitNotesState = {};
const statusInitialState: VisitActionState = {};

function SaveNotesButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-secondary" disabled={pending}>
      {pending ? "Saving…" : "Save notes"}
    </button>
  );
}

function OrganiseNotesButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Organising…" : "Organise notes"}
    </button>
  );
}

function StatusSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-secondary" disabled={pending}>
      {pending ? "Updating…" : "Update status"}
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

export function VisitDetailView({ visit }: { visit: VisitRecord }) {
  const [notesState, notesAction] = useActionState(
    updateVisitNotesAction,
    notesInitialState
  );
  const [organiseState, organiseAction] = useActionState(
    organiseVisitNotesAction,
    organiseInitialState
  );
  const [statusState, statusAction] = useActionState(
    updateVisitStatusAction,
    statusInitialState
  );
  const [notes, setNotes] = useState(visit.notes);

  const organised =
    organiseState.organised && organiseState.notesSnapshot === notes
      ? organiseState.organised
      : null;

  const address = formatVisitAddress(visit);
  const timeLabel = formatVisitTimeLabel(visit.visit_time);
  const visitWhen = [
    formatVisitDateLabel(visit.visit_date),
    timeLabel,
    formatVisitDuration(visit.duration_minutes),
  ]
    .filter(Boolean)
    .join(" · ");
  const createQuoteHref = visit.customer_id
    ? `/proposals/new?customerId=${encodeURIComponent(visit.customer_id)}`
    : "/proposals/new";

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
          <span className={`qf-visit-status qf-visit-status-${visit.status}`}>
            {formatVisitStatus(visit.status)}
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
                Write it the way you saw it — measurements, materials, access,
                timing, customer requests. AI will organise a summary for
                review.
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
            <div className="mt-4 flex flex-wrap gap-3">
              <SaveNotesButton />
            </div>
          </form>

          <form action={organiseAction} className="mt-4">
            <input type="hidden" name="visitId" value={visit.id} />
            <input type="hidden" name="notes" value={notes} />
            {organiseState.error ? (
              <div className="mb-3">
                <AuthError message={organiseState.error} />
              </div>
            ) : null}
            <OrganiseNotesButton />
          </form>
        </SectionCard>

        {organised ? (
          <SectionCard className="qf-card-form">
            <h2 className="qf-card-heading">Organised summary</h2>
            <p className="qf-body-text mt-2 text-muted">
              Check this before you create a quote. Nothing is sent until you
              start a quote yourself.
            </p>
            <div className="qf-change-notes-extract mt-5">
              {VISIT_NOTES_ORGANISED_FIELDS.map(({ key, label }) => (
                <div key={key} className="qf-change-notes-field">
                  <label
                    htmlFor={`visit-organised-${key}`}
                    className="qf-field-label"
                  >
                    {label}
                  </label>
                  <textarea
                    id={`visit-organised-${key}`}
                    className="form-textarea mt-2"
                    rows={3}
                    value={organised[key] || "Nothing noted"}
                    readOnly
                    tabIndex={-1}
                  />
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}

        <SectionCard className="qf-card-form">
          <h2 className="qf-card-heading">Actions</h2>
          <div className="mt-5 space-y-3">
            <Link href={createQuoteHref} className="qf-btn-primary">
              Create Quote
            </Link>
            {visit.customer_id ? (
              <Link
                href={`/customers/${visit.customer_id}`}
                className="qf-btn-secondary"
              >
                View customer
              </Link>
            ) : null}
            {visit.enquiry_id ? (
              <Link
                href={`/enquiries/${visit.enquiry_id}`}
                className="qf-btn-secondary"
              >
                View enquiry
              </Link>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard className="qf-card-form">
          <h2 className="qf-card-heading">Status</h2>
          <form action={statusAction} className="mt-5">
            <input type="hidden" name="visitId" value={visit.id} />
            <label htmlFor="visit-status" className="qf-field-label">
              Visit status
            </label>
            <select
              id="visit-status"
              className="form-select mt-2"
              name="status"
              defaultValue={visit.status}
            >
              {VISIT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatVisitStatus(status)}
                </option>
              ))}
            </select>
            {statusState.error ? (
              <div className="mt-4">
                <AuthError message={statusState.error} />
              </div>
            ) : null}
            {statusState.ok ? (
              <p className="qf-body-text mt-3 text-muted" role="status">
                Status updated.
              </p>
            ) : null}
            <div className="mt-4">
              <StatusSubmitButton />
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
