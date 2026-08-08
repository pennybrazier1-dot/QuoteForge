"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ConversationResolutionSummary } from "@/lib/proposals/change-request/build-conversation-resolution-summary";
import {
  extractProposalChangeNotes,
  type ProposalChangeExtract,
} from "@/lib/proposals/change-request/extract-proposal-change-notes";

const emptyExtract: ProposalChangeExtract = {
  scopeNotes: "",
  materialsNotes: "",
  durationNotes: "",
  priceNotes: "",
  detailNotes: "",
};

export function ProposalChangeNotes({
  proposalId,
  proposalNumber,
  summary,
}: {
  proposalId: string;
  proposalNumber: string;
  summary: ConversationResolutionSummary;
}) {
  const [notes, setNotes] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [extract, setExtract] = useState<ProposalChangeExtract>(emptyExtract);

  const hasAnyExtract = useMemo(
    () =>
      Boolean(
        extract.scopeNotes ||
          extract.materialsNotes ||
          extract.durationNotes ||
          extract.priceNotes ||
          extract.detailNotes
      ),
    [extract]
  );

  return (
    <div className="qf-change-notes-page qf-workspace-page qf-mobile-safe">
      <header className="qf-revision-header">
        <div className="qf-revision-header-top">
          <p className="qf-workspace-number">{proposalNumber}</p>
          <Link
            href={`/proposals/${proposalId}`}
            className="qf-btn-secondary"
          >
            Back to proposal
          </Link>
        </div>
        <h1 className="qf-revision-title">Update proposal</h1>
        <p className="qf-revision-intro">
          Write the changes in your own words. Check the prepared updates before
          anything is saved to the live proposal.
        </p>
      </header>

      <section className="qf-revision-card" aria-label="Conversation summary">
        <h2 className="qf-revision-card-title">From the conversation</h2>
        <div className="qf-resolution-summary">
          <div className="qf-resolution-block">
            <h3 className="qf-resolution-label">What they asked</h3>
            <p className="qf-resolution-copy">{summary.customerAsked}</p>
          </div>
          <div className="qf-resolution-block">
            <h3 className="qf-resolution-label">What was agreed</h3>
            <p className="qf-resolution-copy">{summary.whatWasAgreed}</p>
          </div>
          <div className="qf-resolution-block">
            <h3 className="qf-resolution-label">Possible impact</h3>
            <p className="qf-resolution-copy">{summary.possibleImpact}</p>
          </div>
        </div>
      </section>

      <section className="qf-revision-card" aria-label="Change notes">
        <h2 className="qf-revision-card-title">What needs to change?</h2>
        <p className="qf-revision-card-copy">
          Same idea as Quick Quote notes — messy is fine. Include scope,
          materials, timing, and price if they matter.
        </p>
        <label className="qf-field-label" htmlFor="proposal-change-notes">
          Change notes
        </label>
        <textarea
          id="proposal-change-notes"
          className="form-textarea qf-site-notes-textarea mt-2"
          rows={12}
          maxLength={8000}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setReviewed(false);
          }}
          placeholder="e.g. Add garden wall, switch to grey tiles, may need an extra day, price may rise slightly…"
        />
        <div className="qf-change-notes-actions">
          <button
            type="button"
            className="qf-btn-primary"
            disabled={!notes.trim()}
            onClick={() => {
              setExtract(extractProposalChangeNotes(notes));
              setReviewed(true);
            }}
          >
            Check updates
          </button>
          <Link
            href={`/proposals/${proposalId}`}
            className="qf-btn-secondary"
          >
            Cancel
          </Link>
        </div>
      </section>

      {reviewed ? (
        <section className="qf-revision-card" aria-label="Proposed updates">
          <h2 className="qf-revision-card-title">Proposed updates</h2>
          <p className="qf-revision-card-copy">
            Edit anything below. These are not saved to the live proposal yet.
          </p>
          {!hasAnyExtract ? (
            <p className="qf-revision-card-copy">
              No clear updates found in the notes. Add more detail and try again.
            </p>
          ) : (
            <div className="qf-change-notes-extract">
              <ExtractField
                id="extract-scope"
                label="Scope"
                value={extract.scopeNotes}
                onChange={(value) =>
                  setExtract((current) => ({ ...current, scopeNotes: value }))
                }
              />
              <ExtractField
                id="extract-materials"
                label="Materials"
                value={extract.materialsNotes}
                onChange={(value) =>
                  setExtract((current) => ({
                    ...current,
                    materialsNotes: value,
                  }))
                }
              />
              <ExtractField
                id="extract-duration"
                label="Duration"
                value={extract.durationNotes}
                onChange={(value) =>
                  setExtract((current) => ({
                    ...current,
                    durationNotes: value,
                  }))
                }
              />
              <ExtractField
                id="extract-price"
                label="Price impact"
                value={extract.priceNotes}
                onChange={(value) =>
                  setExtract((current) => ({ ...current, priceNotes: value }))
                }
              />
              <ExtractField
                id="extract-details"
                label="Details"
                value={extract.detailNotes}
                onChange={(value) =>
                  setExtract((current) => ({ ...current, detailNotes: value }))
                }
              />
            </div>
          )}
          <div className="qf-change-notes-actions">
            <button
              type="button"
              className="qf-btn-primary"
              disabled
              title="Saving revised proposals comes next"
            >
              Save revised proposal (soon)
            </button>
            <Link
              href={`/proposals/${proposalId}`}
              className="qf-btn-secondary"
            >
              Back to proposal
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ExtractField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  if (!value.trim()) {
    return null;
  }

  return (
    <div className="qf-change-notes-field">
      <label className="qf-field-label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="form-textarea mt-2"
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
