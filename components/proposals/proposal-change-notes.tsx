"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import type { ConversationResolutionSummary } from "@/lib/proposals/change-request/build-conversation-resolution-summary";
import {
  extractProposalChangeNotes,
  type ProposalChangeExtract,
} from "@/lib/proposals/change-request/extract-proposal-change-notes";
import { formatPenceAsGbp, formatPenceForInput } from "@/lib/proposals/money";
import {
  saveProposalRevision,
  type SaveProposalRevisionState,
} from "@/lib/proposals/revision/save-proposal-revision";
import {
  simulateIssueRevisedProposal,
  type IssueRevisedProposalState,
} from "@/lib/proposals/revision/issue-revised-proposal";

const emptyExtract: ProposalChangeExtract = {
  scopeNotes: "",
  materialsNotes: "",
  durationNotes: "",
  priceNotes: "",
  detailNotes: "",
};

export type ProposalRevisionEditorValues = {
  contentRevision: number;
  scopeOfWork: string;
  jobSummary: string;
  materialsText: string;
  labourText: string;
  labourDescription: string;
  totalAmountPence: number;
  vatAmountPence: number;
  unsentRevisionAt: string | null;
  previousTotalPence: number | null;
  issuedContentRevision: number | null;
  devTestingEnabled: boolean;
};

const initialSaveState: SaveProposalRevisionState = {};
const initialIssueState: IssueRevisedProposalState = {};

export function ProposalChangeNotes({
  proposalId,
  proposalNumber,
  summary,
  current,
}: {
  proposalId: string;
  proposalNumber: string;
  summary: ConversationResolutionSummary;
  current: ProposalRevisionEditorValues;
}) {
  const [notes, setNotes] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [extract, setExtract] = useState<ProposalChangeExtract>(emptyExtract);
  const [scopeOfWork, setScopeOfWork] = useState(current.scopeOfWork);
  const [jobSummary, setJobSummary] = useState(current.jobSummary);
  const [materialsText, setMaterialsText] = useState(current.materialsText);
  const [labourText, setLabourText] = useState(current.labourText);
  const [labourDescription, setLabourDescription] = useState(
    current.labourDescription
  );
  const [totalInput, setTotalInput] = useState(
    formatPenceForInput(current.totalAmountPence)
  );

  const router = useRouter();
  const [saveState, saveAction, savePending] = useActionState(
    saveProposalRevision,
    initialSaveState
  );
  const [issueState, issueAction, issuePending] = useActionState(
    simulateIssueRevisedProposal,
    initialIssueState
  );

  useEffect(() => {
    if (saveState.ok || issueState.ok) {
      router.refresh();
    }
  }, [saveState.ok, issueState.ok, router]);

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

  const revisedTotalLabel = useMemo(() => {
    const cleaned = totalInput.replace(/[£,\s]/g, "").trim();
    const amount = Number(cleaned);
    if (!cleaned || !Number.isFinite(amount) || amount < 0) {
      return null;
    }
    return formatPenceAsGbp(Math.round(amount * 100));
  }, [totalInput]);

  function applyExtractToFields() {
    const next = extractProposalChangeNotes(notes);
    setExtract(next);
    setReviewed(true);
    if (next.scopeNotes.trim()) {
      setScopeOfWork((prev) =>
        prev.trim() ? `${prev.trim()}\n${next.scopeNotes.trim()}` : next.scopeNotes.trim()
      );
    }
    if (next.materialsNotes.trim()) {
      setMaterialsText((prev) =>
        prev.trim()
          ? `${prev.trim()}\n${next.materialsNotes.trim()}`
          : next.materialsNotes.trim()
      );
    }
    if (next.detailNotes.trim() || next.durationNotes.trim()) {
      const detail = [next.detailNotes, next.durationNotes]
        .map((part) => part.trim())
        .filter(Boolean)
        .join("\n");
      setLabourDescription((prev) =>
        prev.trim() ? `${prev.trim()}\n${detail}` : detail
      );
    }
    if (next.priceNotes.trim()) {
      const match = next.priceNotes.match(/£\s*(\d[\d,]*(?:\.\d{1,2})?)/);
      if (match?.[1]) {
        setTotalInput(match[1].replace(/,/g, ""));
      }
    }
  }

  return (
    <div className="qf-trader-page qf-change-notes-page qf-workspace-page qf-mobile-safe">
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
          Change the scope and price, then save. The customer cannot accept until
          you send the revised proposal in a later step.
        </p>
        <p className="qf-revision-card-copy">
          Current total:{" "}
          <strong>{formatPenceAsGbp(current.totalAmountPence)}</strong>
          {current.previousTotalPence != null ? (
            <>
              {" "}
              · Previous auditable total:{" "}
              <strong>{formatPenceAsGbp(current.previousTotalPence)}</strong>
            </>
          ) : null}
          {current.unsentRevisionAt ? (
            <>
              {" "}
              · Status: <strong>saved, awaiting issue</strong>. Save and Issue
              are different actions.
            </>
          ) : current.issuedContentRevision != null ? (
            <>
              {" "}
              · Last issued revision: {current.issuedContentRevision}
            </>
          ) : null}
        </p>
      </header>

      <section className="qf-revision-card" aria-label="Conversation summary">
        <h2 className="qf-revision-card-title">Customer request</h2>
        <div className="qf-resolution-summary">
          <div className="qf-resolution-block">
            <h3 className="qf-resolution-label">Customer requests</h3>
            {summary.customerRequestItems.length > 0 ? (
              <ul className="qf-resolution-request-list">
                {summary.customerRequestItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="qf-resolution-copy">{summary.customerRequest}</p>
            )}
          </div>
          <div className="qf-resolution-block">
            <h3 className="qf-resolution-label">Original wording</h3>
            <div className="qf-resolution-copy qf-resolution-quote qf-resolution-wording">
              {summary.originalRequestWording.split("\n").map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          {summary.possibleImpacts.length > 0 ? (
            <div className="qf-resolution-block">
              <h3 className="qf-resolution-label">Possible impact</h3>
              <ul className="qf-resolution-request-list">
                {summary.possibleImpacts.map((impact) => (
                  <li key={impact}>{impact}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="qf-revision-card" aria-label="Change notes">
        <h2 className="qf-revision-card-title">What needs to change?</h2>
        <p className="qf-revision-card-copy">
          Optional notes to prepare the fields below. Messy is fine.
        </p>
        <label className="qf-field-label" htmlFor="proposal-change-notes">
          Change notes
        </label>
        <textarea
          id="proposal-change-notes"
          className="form-textarea qf-site-notes-textarea mt-2"
          rows={8}
          maxLength={8000}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setReviewed(false);
          }}
          placeholder="e.g. Switch to eggshell finish, price rises to £920…"
        />
        <div className="qf-change-notes-actions">
          <button
            type="button"
            className="qf-btn-secondary"
            disabled={!notes.trim()}
            onClick={applyExtractToFields}
          >
            Check updates
          </button>
        </div>
        {reviewed && hasAnyExtract ? (
          <p className="qf-revision-card-copy mt-3">
            Suggested notes applied into the fields below — review before saving.
          </p>
        ) : null}
      </section>

      <section className="qf-revision-card" aria-label="Revised proposal">
        <h2 className="qf-revision-card-title">Revised quote</h2>
        <p className="qf-revision-card-copy">
          Edit scope, labour, materials, and the total. VAT stays{" "}
          {formatPenceAsGbp(current.vatAmountPence)} (unchanged).
        </p>

        <form action={saveAction} className="qf-change-notes-extract">
          <input type="hidden" name="proposalId" value={proposalId} />
          <input
            type="hidden"
            name="expectedContentRevision"
            value={String(current.contentRevision)}
          />
          <input type="hidden" name="changeNotes" value={notes} />

          <ExtractField
            id="revise-job-summary"
            label="Job summary"
            name="jobSummary"
            value={jobSummary}
            onChange={setJobSummary}
          />
          <ExtractField
            id="revise-scope"
            label="Scope of work"
            name="scopeOfWork"
            value={scopeOfWork}
            onChange={setScopeOfWork}
          />
          <ExtractField
            id="revise-materials"
            label="Materials (one per line)"
            name="materials"
            value={materialsText}
            onChange={setMaterialsText}
          />
          <ExtractField
            id="revise-labour-lines"
            label="Labour items (one per line)"
            name="labour"
            value={labourText}
            onChange={setLabourText}
          />
          <ExtractField
            id="revise-labour-description"
            label="Labour description"
            name="labourDescription"
            value={labourDescription}
            onChange={setLabourDescription}
          />

          <div className="qf-field">
            <label className="qf-field-label" htmlFor="revise-total">
              Revised total (£)
            </label>
            <input
              id="revise-total"
              name="totalAmount"
              type="text"
              inputMode="decimal"
              className="form-input mt-2"
              value={totalInput}
              onChange={(event) => setTotalInput(event.target.value)}
              required
            />
            {revisedTotalLabel ? (
              <p className="qf-revision-card-copy mt-2">
                Customer will eventually see: <strong>{revisedTotalLabel}</strong>
              </p>
            ) : null}
          </div>

          {saveState.error ? (
            <p className="qf-form-error" role="alert">
              {saveState.error}
            </p>
          ) : null}
          {saveState.ok ? (
            <p className="qf-revision-card-copy" role="status">
              Revision {saveState.revisionNumber} saved. Previous{" "}
              {formatPenceAsGbp(saveState.previousTotalPence ?? 0)} kept in
              history. New total{" "}
              {formatPenceAsGbp(saveState.newTotalPence ?? 0)}. Customer
              acceptance stays locked until you send this update.
            </p>
          ) : null}

          <div className="qf-change-notes-actions">
            <button
              type="submit"
              className="qf-btn-primary"
              disabled={savePending}
            >
              {savePending ? "Saving…" : "Save revised proposal"}
            </button>
            <Link
              href={`/proposals/${proposalId}`}
              className="qf-btn-secondary"
            >
              Back to proposal
            </Link>
          </div>
        </form>
      </section>

      {current.unsentRevisionAt && current.devTestingEnabled ? (
        <section className="qf-revision-card" aria-label="Issue revised proposal">
          <h2 className="qf-revision-card-title">Issue revised proposal</h2>
          <p className="qf-revision-card-copy">
            Explicit test issue only. Does not call Resend. Clears the unsent
            lock after a successful local simulation, but customer acceptance
            stays blocked until Stage 2I version-safe acceptance.
          </p>
          <form action={issueAction} className="qf-change-notes-actions">
            <input type="hidden" name="proposalId" value={proposalId} />
            <input
              type="hidden"
              name="expectedContentRevision"
              value={String(current.contentRevision)}
            />
            <button
              type="submit"
              className="qf-btn-primary"
              disabled={issuePending}
            >
              {issuePending ? "Issuing…" : "Test: Issue revised proposal"}
            </button>
          </form>
          {issueState.error ? (
            <p className="qf-form-error" role="alert">
              {issueState.error}
            </p>
          ) : null}
          {issueState.ok ? (
            <p className="qf-revision-card-copy" role="status">
              Issued revision {issueState.revisionNumber}. Previous{" "}
              {formatPenceAsGbp(issueState.previousTotalPence ?? 0)} remains in
              history. New total{" "}
              {formatPenceAsGbp(issueState.newTotalPence ?? 0)}. Simulation
              only — not confirmed customer delivery.
            </p>
          ) : null}
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
  name,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  name?: string;
}) {
  return (
    <div className="qf-field">
      <label className="qf-field-label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        className="form-textarea mt-2"
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
