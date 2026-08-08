"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
import {
  updateVisitNotesAction,
  updateVisitStatusAction,
  type VisitActionState,
} from "@/lib/visits/actions";
import { extractVisitNotes } from "@/lib/visits/extract-visit-notes";
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

const initialState: VisitActionState = {};

function NotesSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save notes"}
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
    initialState
  );
  const [statusState, statusAction] = useActionState(
    updateVisitStatusAction,
    initialState
  );
  const [notes, setNotes] = useState(visit.notes);
  const [extractOpen, setExtractOpen] = useState(false);
  const extract = useMemo(() => extractVisitNotes(notes), [notes]);
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
        <span
          className={`qf-visit-status qf-visit-status-${visit.status}`}
        >
          {formatVisitStatus(visit.status)}
        </span>
      </header>

      <section className="qf-visit-card">
        <h2 className="qf-visit-card-title">Visit details</h2>
        <dl className="qf-visit-facts">
          <div>
            <dt>Customer</dt>
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
            <div>
              <dt>Address</dt>
              <dd>{address}</dd>
            </div>
          ) : null}
          {visit.enquiry_summary ? (
            <div className="qf-visit-facts-wide">
              <dt>Reason / summary</dt>
              <dd>{visit.enquiry_summary}</dd>
            </div>
          ) : null}
        </dl>
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

      <section className="qf-visit-card">
        <h2 className="qf-visit-card-title">After the visit</h2>
        <p className="qf-visit-card-copy">
          Add notes from the visit. You can prepare them into sections before
          starting a quote.
        </p>
        <form action={notesAction} className="qf-visit-notes-form">
          <input type="hidden" name="visitId" value={visit.id} />
          <label className="qf-visit-field" htmlFor="visit-notes">
            <span>Visit notes</span>
            <textarea
              id="visit-notes"
              className="qf-input qf-visit-textarea"
              name="notes"
              rows={8}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setExtractOpen(false);
              }}
              placeholder="Measurements, access, materials, next steps…"
            />
          </label>
          <div className="qf-visit-actions">
            <NotesSubmitButton />
            <button
              type="button"
              className="qf-btn-secondary"
              onClick={() => setExtractOpen(true)}
              disabled={!notes.trim()}
            >
              Prepare notes
            </button>
          </div>
          {notesState.error ? <AuthError message={notesState.error} /> : null}
          {notesState.ok ? (
            <p className="qf-visit-notice" role="status">
              Notes saved.
            </p>
          ) : null}
        </form>

        {extractOpen ? (
          <div className="qf-visit-extract" aria-label="Prepared notes">
            <h3 className="qf-visit-extract-title">Prepared notes</h3>
            <p className="qf-visit-card-copy">
              Check these before you create a quote. Nothing is sent until you
              start a quote yourself.
            </p>
            <dl className="qf-visit-extract-list">
              <div>
                <dt>Measurements</dt>
                <dd>{extract.measurements || "None spotted"}</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>{extract.accessNotes || "None spotted"}</dd>
              </div>
              <div>
                <dt>Materials</dt>
                <dd>{extract.materialsNotes || "None spotted"}</dd>
              </div>
              <div>
                <dt>Follow-up</dt>
                <dd>{extract.followUpNotes || "None spotted"}</dd>
              </div>
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
    </div>
  );
}
