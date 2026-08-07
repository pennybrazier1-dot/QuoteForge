"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  acceptPublicProposal,
  askPublicProposalQuestion,
  requestPublicProposalChanges,
  type CustomerPortalActionState,
} from "@/lib/proposals/customer-portal/actions";
import type { PublicProposalViewModel } from "@/lib/proposals/customer-portal/load-public-proposal";
import {
  buildCustomerProposalPdfPath,
} from "@/lib/proposals/customer-portal/token";

const initialState: CustomerPortalActionState = {};

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="cj-portal-muted">None listed.</p>;
  }

  return (
    <ul className="cj-portal-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function PortalShell({
  children,
  businessName,
}: {
  children: ReactNode;
  businessName?: string;
}) {
  return (
    <div className="cj-root cj-root--portal">
      <div className="cj-page">
        <PortalHeader businessName={businessName} />
        <main className="cj-portal-page">{children}</main>
      </div>
    </div>
  );
}

function PortalHeader({ businessName }: { businessName?: string }) {
  return (
    <header className="cj-header cj-portal-header">
      <div className="cj-header-brand">
        <div className="cj-logo">
          <span className="cj-portal-brand-mark" aria-hidden="true">
            R
          </span>
          <span className="cj-logo-text cj-portal-brand-name">Reanvil</span>
        </div>
        <p className="cj-header-subtitle">Your proposal</p>
      </div>
      {businessName ? (
        <div className="cj-portal-trader">
          <p className="cj-portal-trader-label">From</p>
          <p className="cj-portal-trader-name">{businessName}</p>
        </div>
      ) : null}
    </header>
  );
}

export function CustomerProposalPortal({
  view,
}: {
  view: PublicProposalViewModel;
}) {
  const [mode, setMode] = useState<
    "idle" | "accept" | "question" | "changes"
  >("idle");
  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptPublicProposal,
    initialState
  );
  const [questionState, questionAction, questionPending] = useActionState(
    askPublicProposalQuestion,
    initialState
  );
  const [changesState, changesAction, changesPending] = useActionState(
    requestPublicProposalChanges,
    initialState
  );

  const successResult =
    acceptState.result || questionState.result || changesState.result;
  const error =
    acceptState.error || questionState.error || changesState.error || null;

  if (view.isClosed) {
    return (
      <PortalShell businessName={view.businessName}>
        <section className="cj-job-card">
          <h1 className="cj-job-title">Proposal unavailable</h1>
          <p className="cj-job-copy">
            This proposal is no longer open. Please contact{" "}
            {view.businessName} if you need help.
          </p>
        </section>
      </PortalShell>
    );
  }

  if (successResult === "accepted" || view.isAccepted) {
    return (
      <PortalShell businessName={view.businessName}>
        <section className="cj-job-card cj-portal-success">
          <p className="cj-job-eyebrow">Accepted</p>
          <h1 className="cj-job-title">Thank you</h1>
          <p className="cj-job-copy">
            Thanks, your proposal has been accepted. The trader will contact
            you about next steps.
          </p>
          <a
            className="cj-btn-secondary cj-portal-pdf"
            href={buildCustomerProposalPdfPath(view.token)}
          >
            Download PDF
          </a>
        </section>
        <ProposalBody view={view} />
      </PortalShell>
    );
  }

  if (successResult === "question" || successResult === "changes") {
    return (
      <PortalShell businessName={view.businessName}>
        <section className="cj-job-card cj-portal-success">
          <p className="cj-job-eyebrow">Sent</p>
          <h1 className="cj-job-title">
            {successResult === "question"
              ? "Question sent"
              : "Change request sent"}
          </h1>
          <p className="cj-job-copy">
            We’ve passed this to {view.businessName}. They’re reviewing your
            message and will respond soon.
          </p>
        </section>
        <ProposalBody view={view} />
      </PortalShell>
    );
  }

  return (
    <PortalShell businessName={view.businessName}>
      <section className="cj-job-card cj-portal-hero">
        <p className="cj-job-eyebrow">Proposal {view.proposalNumber}</p>
        <h1 className="cj-job-title">{view.title}</h1>
        {(view.customerName || view.customerAddress) && (
          <p className="cj-job-copy">
            {[view.customerName, view.customerAddress]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <p className="cj-portal-price">{view.priceLabel}</p>
        <a
          className="cj-btn-secondary cj-portal-pdf"
          href={buildCustomerProposalPdfPath(view.token)}
        >
          Download PDF
        </a>
      </section>

      <ProposalBody view={view} />

      {view.canRespond ? (
        <section className="cj-job-card cj-portal-actions">
          <h2 className="cj-job-section-title">Your response</h2>
          <p className="cj-job-copy">
            Choose how you’d like to respond. You don’t need an account.
          </p>

          {error ? (
            <p className="cj-portal-error" role="alert">
              {error}
            </p>
          ) : null}

          {mode === "idle" ? (
            <div className="cj-portal-action-row">
              <button
                type="button"
                className="cj-btn-primary"
                onClick={() => setMode("accept")}
              >
                Accept proposal
              </button>
              <button
                type="button"
                className="cj-btn-secondary"
                onClick={() => setMode("changes")}
              >
                Request changes
              </button>
              <button
                type="button"
                className="cj-btn-secondary"
                onClick={() => setMode("question")}
              >
                Ask a question
              </button>
            </div>
          ) : null}

          {mode === "accept" ? (
            <form action={acceptAction} className="cj-portal-form">
              <input type="hidden" name="token" value={view.token} />
              <p className="cj-job-copy">
                You’re happy to go ahead at <strong>{view.priceLabel}</strong>{" "}
                with {view.businessName}.
              </p>
              <label className="cj-portal-label" htmlFor="accept-note">
                Optional note
              </label>
              <textarea
                id="accept-note"
                name="note"
                rows={3}
                className="cj-portal-textarea"
                placeholder="Anything we should know before starting?"
              />
              <div className="cj-portal-form-actions">
                <button
                  type="submit"
                  className="cj-btn-primary"
                  disabled={acceptPending}
                >
                  {acceptPending ? "Accepting…" : "Confirm acceptance"}
                </button>
                <button
                  type="button"
                  className="cj-btn-secondary"
                  onClick={() => setMode("idle")}
                  disabled={acceptPending}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {mode === "question" ? (
            <form action={questionAction} className="cj-portal-form">
              <input type="hidden" name="token" value={view.token} />
              <label className="cj-portal-label" htmlFor="question-message">
                Your question
              </label>
              <textarea
                id="question-message"
                name="message"
                required
                rows={4}
                className="cj-portal-textarea"
                placeholder="Ask anything about the proposal…"
              />
              <div className="cj-portal-form-actions">
                <button
                  type="submit"
                  className="cj-btn-primary"
                  disabled={questionPending}
                >
                  {questionPending ? "Sending…" : "Send question"}
                </button>
                <button
                  type="button"
                  className="cj-btn-secondary"
                  onClick={() => setMode("idle")}
                  disabled={questionPending}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {mode === "changes" ? (
            <form action={changesAction} className="cj-portal-form">
              <input type="hidden" name="token" value={view.token} />
              <label className="cj-portal-label" htmlFor="changes-message">
                What would you like changed?
              </label>
              <textarea
                id="changes-message"
                name="message"
                required
                rows={4}
                className="cj-portal-textarea"
                placeholder="Describe the changes you’d like…"
              />
              <div className="cj-portal-form-actions">
                <button
                  type="submit"
                  className="cj-btn-primary"
                  disabled={changesPending}
                >
                  {changesPending ? "Sending…" : "Send request"}
                </button>
                <button
                  type="button"
                  className="cj-btn-secondary"
                  onClick={() => setMode("idle")}
                  disabled={changesPending}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : (
        <section className="cj-job-card">
          <h2 className="cj-job-section-title">Response</h2>
          <p className="cj-job-copy">
            This proposal isn’t open for a new response right now. Contact{" "}
            {view.businessName} if you need help.
          </p>
        </section>
      )}
    </PortalShell>
  );
}

function ProposalBody({ view }: { view: PublicProposalViewModel }) {
  return (
    <>
      <section className="cj-job-card">
        <h2 className="cj-job-section-title">Summary</h2>
        <p className="cj-job-copy">{view.projectSummary}</p>
      </section>

      <section className="cj-job-card">
        <h2 className="cj-job-section-title">Scope of work</h2>
        <BulletList items={view.scopeOfWork} />
      </section>

      {view.materials.length > 0 ? (
        <section className="cj-job-card">
          <h2 className="cj-job-section-title">Materials</h2>
          <BulletList items={view.materials} />
        </section>
      ) : null}

      {(view.estimatedDuration || view.plannedStartLabel) && (
        <section className="cj-job-card">
          <h2 className="cj-job-section-title">Timing</h2>
          {view.estimatedDuration ? (
            <p className="cj-job-copy">Duration: {view.estimatedDuration}</p>
          ) : null}
          {view.plannedStartLabel ? (
            <p className="cj-job-copy">Start: {view.plannedStartLabel}</p>
          ) : null}
        </section>
      )}

      {view.beforeWorkBegins.length > 0 ? (
        <section className="cj-job-card">
          <h2 className="cj-job-section-title">Before work begins</h2>
          <BulletList items={view.beforeWorkBegins} />
        </section>
      ) : null}

      {view.optionalExtras.length > 0 ? (
        <section className="cj-job-card">
          <h2 className="cj-job-section-title">Optional extras</h2>
          <BulletList items={view.optionalExtras} />
        </section>
      ) : null}
    </>
  );
}
