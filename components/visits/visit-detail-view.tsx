"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
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
  const createQuoteHref = visit.customer_id
    ? `/proposals/new?customerId=${encodeURIComponent(visit.customer_id)}`
    : "/proposals/new";

  return (
    <div className="qf-visit-detail">
      <header className="qf-visit-detail-header">
        <div>
          <Link href="/visits" className="qf-visit-back">
            ← Back to visits
          </Link>
          <p className="qf-visit-eyebrow">{formatVisitType(visit.visit_type)}</p>
          <h1 className="qf-visit-detail-title">{visit.customer_name}</h1>
          <p className="qf-visit-detail-meta">
            {[
              formatVisitDateLabel(visit.visit_date),
              timeLabel,
              formatVisitDuration(visit.duration_minutes),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className={`qf-visit-status qf-visit-status-${visit.status}`}>
          {formatVisitStatus(visit.status)}
        </span>
      </header>

      <section className="qf-visit-card">
        <h2 className="qf-visit-card-title">Customer</h2>
        <dl className="qf-visit-facts">
          <div>
            <dt>Customer name</dt>
            <dd>{visit.customer_name}</dd>
          </div>
          {visit.contact_phone ? (
            <div>
              <dt>Phone</dt>
              <dd>{visit.contact_phone}</dd>
            </div>
          ) : null}
          {visit.contact_email ? (
            <div>
              <dt>Email</dt>
              <dd>{visit.contact_email}</dd>
            </div>
          ) : null}
          {address ? (
            <div className="qf-visit-facts-wide">
              <dt>Address</dt>
              <dd>{address}</dd>
            </div>
          ) : null}
          <div className="qf-visit-facts-wide">
            <dt>Visit date / time</dt>
            <dd>
              {[
                formatVisitDateLabel(visit.visit_date),
                timeLabel,
                formatVisitDuration(visit.duration_minutes),
              ]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        </dl>
      </section>

      <section className="qf-visit-card">
        <h2 className="qf-visit-card-title">Visit notes</h2>
        <p className="qf-visit-card-copy">
          Write it the way you saw it — measurements, materials, access, timing,
          customer requests. AI will organise a summary for review.
        </p>

        <form action={notesAction} className="qf-visit-notes-form">
          <input type="hidden" name="visitId" value={visit.id} />
          <label className="qf-visit-field" htmlFor="visit-notes">
            <span>What did you find?</span>
            <textarea
              id="visit-notes"
              className="qf-input qf-visit-textarea qf-visit-notes-large"
              name="notes"
              rows={14}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Write what you found during the visit..."
            />
          </label>
          {notesState.error ? <AuthError message={notesState.error} /> : null}
          {notesState.ok ? (
            <p className="qf-visit-notice" role="status">
              Notes saved.
            </p>
          ) : null}
          <div className="qf-visit-actions">
            <SaveNotesButton />
          </div>
        </form>

        <form action={organiseAction} className="qf-visit-organise-form">
          <input type="hidden" name="visitId" value={visit.id} />
          <input type="hidden" name="notes" value={notes} />
          {organiseState.error ? (
            <AuthError message={organiseState.error} />
          ) : null}
          <div className="qf-visit-actions">
            <OrganiseNotesButton />
          </div>
        </form>

        {organised ? (
          <div className="qf-visit-extract" aria-label="Organised summary">
            <h3 className="qf-visit-extract-title">Organised summary</h3>
            <p className="qf-visit-card-copy">
              Check this before you create a quote. Nothing is sent until you
              start a quote yourself.
            </p>
            <dl className="qf-visit-extract-list">
              {VISIT_NOTES_ORGANISED_FIELDS.map(({ key, label }) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{organised[key] || "Nothing noted"}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="qf-visit-quote-action">
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
      </section>

      <section className="qf-visit-card">
        <h2 className="qf-visit-card-title">Status</h2>
        <form action={statusAction} className="qf-visit-status-form">
          <input type="hidden" name="visitId" value={visit.id} />
          <label className="qf-visit-field">
            <span>Visit status</span>
            <select
              className="qf-input"
              name="status"
              defaultValue={visit.status}
            >
              {VISIT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatVisitStatus(status)}
                </option>
              ))}
            </select>
          </label>
          {statusState.error ? <AuthError message={statusState.error} /> : null}
          {statusState.ok ? (
            <p className="qf-visit-notice" role="status">
              Status updated.
            </p>
          ) : null}
          <StatusSubmitButton />
        </form>
      </section>
    </div>
  );
}
