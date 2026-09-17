"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CustomerPortalConversation } from "@/components/proposals/customer-portal/customer-portal-conversation";
import {
  acceptProposedScheduleDate,
  acceptPublicProposal,
  askPublicProposalQuestion,
  declinePublicProposal,
  holdPublicAvailabilitySlot,
  requestAnotherScheduleDate,
  requestPublicProposalChanges,
  type CustomerPortalActionState,
} from "@/lib/proposals/customer-portal/actions";
import type { PublicProposalViewModel } from "@/lib/proposals/customer-portal/load-public-proposal";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import { buildCustomerProposalPdfPath } from "@/lib/proposals/customer-portal/token";

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
  messages = [],
}: {
  view: PublicProposalViewModel;
  messages?: ProposalCustomerMessage[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<
    "idle" | "accept" | "question" | "changes" | "request_date" | "decline"
  >("idle");
  const [selectedSlotId, setSelectedSlotId] = useState("");
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
  const [acceptDateState, acceptDateAction, acceptDatePending] = useActionState(
    acceptProposedScheduleDate,
    initialState
  );
  const [requestDateState, requestDateAction, requestDatePending] =
    useActionState(requestAnotherScheduleDate, initialState);
  const [holdState, holdAction, holdPending] = useActionState(
    holdPublicAvailabilitySlot,
    initialState
  );
  const [declineState, declineAction, declinePending] = useActionState(
    declinePublicProposal,
    initialState
  );

  const successResult =
    acceptState.result ||
    questionState.result ||
    changesState.result ||
    acceptDateState.result ||
    requestDateState.result ||
    declineState.result;
  const error =
    acceptState.error ||
    questionState.error ||
    changesState.error ||
    acceptDateState.error ||
    requestDateState.error ||
    holdState.error ||
    declineState.error ||
    null;

  useEffect(() => {
    if (
      questionState.ok ||
      changesState.ok ||
      acceptState.ok ||
      acceptDateState.ok ||
      requestDateState.ok ||
      holdState.ok ||
      declineState.ok
    ) {
      router.refresh();
    }
  }, [
    questionState.ok,
    changesState.ok,
    acceptState.ok,
    acceptDateState.ok,
    requestDateState.ok,
    holdState.ok,
    declineState.ok,
    router,
  ]);

  if (successResult === "declined" || view.isDeclined) {
    return (
      <PortalShell businessName={view.businessName}>
        <section className="cj-job-card">
          <p className="cj-job-eyebrow">Declined</p>
          <h1 className="cj-job-title">Proposal declined</h1>
          <p className="cj-job-copy">
            You declined this proposal. If that was a mistake, contact{" "}
            {view.businessName}.
          </p>
        </section>
      </PortalShell>
    );
  }

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
            Your proposal and booking are confirmed
            {view.plannedStartLabel ? ` for ${view.plannedStartLabel}` : ""}.
          </p>
          <a
            className="cj-btn-secondary cj-portal-pdf"
            href={buildCustomerProposalPdfPath(view.token)}
          >
            Download PDF
          </a>
        </section>
        {view.canRespondToProposedDate && view.proposedDateLabel && !view.canAcceptProposal ? (
          <ProposedBookingCard
            view={view}
            error={error}
            mode={mode}
            setMode={setMode}
            acceptDateAction={acceptDateAction}
            acceptDatePending={acceptDatePending}
            requestDateAction={requestDateAction}
            requestDatePending={requestDatePending}
          />
        ) : null}
        <CustomerPortalConversation
          token={view.token}
          messages={messages}
          canRespond={view.canRespondToProposedDate}
          businessName={view.businessName}
        />
        <ProposalBody view={view} />
      </PortalShell>
    );
  }

  if (successResult === "date_accepted") {
    return (
      <PortalShell businessName={view.businessName}>
        <section className="cj-job-card cj-portal-success">
          <p className="cj-job-eyebrow">Date confirmed</p>
          <h1 className="cj-job-title">Thank you</h1>
          <p className="cj-job-copy">
            You’ve confirmed
            {view.plannedStartLabel ? ` ${view.plannedStartLabel}` : " this date"}.
          </p>
        </section>
        <CustomerPortalConversation
          token={view.token}
          messages={messages}
          canRespond={view.canRespond}
          businessName={view.businessName}
        />
        <ProposalBody view={view} />
      </PortalShell>
    );
  }

  if (
    successResult === "question" ||
    successResult === "changes" ||
    successResult === "date_change_requested"
  ) {
    return (
      <PortalShell businessName={view.businessName}>
        <section className="cj-job-card cj-portal-success">
          <p className="cj-job-eyebrow">Sent</p>
          <h1 className="cj-job-title">
            {successResult === "question"
              ? "Question sent"
              : successResult === "date_change_requested"
                ? "Date change requested"
                : "Change request sent"}
          </h1>
          <p className="cj-job-copy">
            We’ve passed this to {view.businessName}. They’re reviewing your
            message and will respond soon. You can keep the conversation going
            below.
          </p>
        </section>
        <CustomerPortalConversation
          token={view.token}
          messages={messages}
          canRespond={view.canRespond}
          businessName={view.businessName}
        />
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

      {view.canRespondToProposedDate &&
      view.proposedDateLabel &&
      !view.canAcceptProposal ? (
        <ProposedBookingCard
          view={view}
          error={error}
          mode={mode}
          setMode={setMode}
          acceptDateAction={acceptDateAction}
          acceptDatePending={acceptDatePending}
          requestDateAction={requestDateAction}
          requestDatePending={requestDatePending}
        />
      ) : null}

      <CustomerPortalConversation
        token={view.token}
        messages={messages}
        canRespond={view.canRespond}
        businessName={view.businessName}
      />

      {view.canRespond ? (
        <section className="cj-job-card cj-portal-actions">
          <h2 className="cj-job-section-title">Your response</h2>
          <p className="cj-job-copy">
            {view.canAcceptProposal
              ? "Accept the proposal, request a change, ask a question, or decline."
              : "Choose an available date before you can accept this proposal."}
          </p>

          {error ? (
            <p className="cj-portal-error" role="alert">
              {error}
            </p>
          ) : null}

          {mode === "idle" ? (
            <div className="cj-portal-action-row">
              {view.canAcceptProposal ? (
                <button
                  type="button"
                  className="cj-btn-primary"
                  onClick={() => setMode("accept")}
                >
                  {view.dateOfferSource === "trader"
                    ? "Accept proposal & date"
                    : "Accept proposal"}
                </button>
              ) : (
                <button
                  type="button"
                  className="cj-btn-primary"
                  onClick={() => setMode("accept")}
                >
                  Choose a date
                </button>
              )}
              <button
                type="button"
                className="cj-btn-secondary"
                onClick={() => setMode("request_date")}
              >
                Request different date/time
              </button>
              <button
                type="button"
                className="cj-btn-secondary"
                onClick={() => setMode("changes")}
              >
                Request a change
              </button>
              <button
                type="button"
                className="cj-btn-secondary"
                onClick={() => setMode("question")}
              >
                Ask a question
              </button>
              <button
                type="button"
                className="cj-btn-secondary"
                onClick={() => setMode("decline")}
              >
                Decline
              </button>
            </div>
          ) : null}

          {mode === "accept" && view.canAcceptProposal ? (
            <form action={acceptAction} className="cj-portal-form">
              <input type="hidden" name="token" value={view.token} />
              <p className="cj-job-copy">
                You’re happy to go ahead at <strong>{view.priceLabel}</strong>
                {view.selectedSlotLabel ? (
                  <>
                    {" "}
                    on <strong>{view.selectedSlotLabel}</strong>
                  </>
                ) : null}{" "}
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
                  {acceptPending
                    ? "Accepting…"
                    : view.dateOfferSource === "trader"
                      ? "Accept proposal & date"
                      : "Accept proposal"}
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

          {mode === "accept" && !view.canAcceptProposal ? (
            <form action={acceptAction} className="cj-portal-form">
              <input type="hidden" name="token" value={view.token} />
              <p className="cj-job-copy">
                {view.scheduleMode === "range"
                  ? "Choose a date range that fits the work."
                  : "Choose one available appointment."}
              </p>
              {view.availabilitySlots.length === 0 ? (
                <p className="cj-job-copy">
                  No offered times are available right now. Request a different
                  date/time and the trader will suggest another.
                </p>
              ) : (
                <ul className="cj-portal-slot-list">
                  {view.availabilitySlots.map((slot) => (
                    <li key={slot.id}>
                      <label className="cj-portal-slot">
                        <input
                          type="radio"
                          name="slotId"
                          value={slot.id}
                          checked={selectedSlotId === slot.id}
                          onChange={() => {
                            setSelectedSlotId(slot.id);
                            const data = new FormData();
                            data.set("token", view.token);
                            data.set("slotId", slot.id);
                            holdAction(data);
                          }}
                        />
                        <span>{slot.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <div className="cj-portal-form-actions">
                <button
                  type="submit"
                  className="cj-btn-primary"
                  disabled={acceptPending || holdPending || !selectedSlotId}
                >
                  {acceptPending
                    ? "Booking…"
                    : view.scheduleMode === "range"
                      ? "Accept proposal & book these dates"
                      : "Accept proposal & book this time"}
                </button>
                <button
                  type="button"
                  className="cj-btn-secondary"
                  onClick={() => setMode("request_date")}
                  disabled={acceptPending}
                >
                  Request different date/time
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

          {mode === "request_date" ? (
            <form action={requestDateAction} className="cj-portal-form">
              <input type="hidden" name="token" value={view.token} />
              <label className="cj-portal-label" htmlFor="requested-date">
                Date that would work
              </label>
              <input
                id="requested-date"
                type="date"
                name="requestedDate"
                className="cj-portal-textarea"
              />
              <label className="cj-portal-label" htmlFor="requested-time">
                Time (optional)
              </label>
              <input
                id="requested-time"
                type="time"
                name="requestedTime"
                className="cj-portal-textarea"
              />
              <label className="cj-portal-label" htmlFor="request-date-message">
                Anything else we should know?
              </label>
              <textarea
                id="request-date-message"
                name="message"
                required
                rows={3}
                className="cj-portal-textarea"
                placeholder="e.g. Mornings are better, or the week after."
              />
              <div className="cj-portal-form-actions">
                <button
                  type="submit"
                  className="cj-btn-primary"
                  disabled={requestDatePending}
                >
                  {requestDatePending ? "Sending…" : "Request different date/time"}
                </button>
                <button
                  type="button"
                  className="cj-btn-secondary"
                  onClick={() => setMode("idle")}
                  disabled={requestDatePending}
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

          {mode === "decline" ? (
            <form action={declineAction} className="cj-portal-form">
              <input type="hidden" name="token" value={view.token} />
              <p className="cj-job-copy">
                This closes the proposal. The trader will see that you declined.
              </p>
              <label className="cj-portal-label" htmlFor="decline-note">
                Optional reason
              </label>
              <textarea
                id="decline-note"
                name="note"
                rows={3}
                className="cj-portal-textarea"
                placeholder="You can leave this blank."
              />
              <div className="cj-portal-form-actions">
                <button
                  type="submit"
                  className="cj-btn-primary"
                  disabled={declinePending}
                >
                  {declinePending ? "Declining…" : "Confirm decline"}
                </button>
                <button
                  type="button"
                  className="cj-btn-secondary"
                  onClick={() => setMode("idle")}
                  disabled={declinePending}
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

function ProposedBookingCard({
  view,
  error,
  mode,
  setMode,
  acceptDateAction,
  acceptDatePending,
  requestDateAction,
  requestDatePending,
}: {
  view: PublicProposalViewModel;
  error: string | null;
  mode: "idle" | "accept" | "question" | "changes" | "request_date" | "decline";
  setMode: (
    mode: "idle" | "accept" | "question" | "changes" | "request_date" | "decline"
  ) => void;
  acceptDateAction: (payload: FormData) => void;
  acceptDatePending: boolean;
  requestDateAction: (payload: FormData) => void;
  requestDatePending: boolean;
}) {
  return (
    <section className="cj-job-card cj-portal-actions">
      <h2 className="cj-job-section-title">Proposed booking</h2>
      <p className="cj-job-copy">
        <strong>{view.proposedDateLabel}</strong>
      </p>
      <p className="cj-job-copy">
        {view.canAcceptProposal
          ? "New date proposed. Accept the proposal and this date together, or request another date/time."
          : "Confirm this date if it works, or request another date."}
      </p>

      {error ? (
        <p className="cj-portal-error" role="alert">
          {error}
        </p>
      ) : null}

      {mode !== "request_date" ? (
        <div className="cj-portal-action-row">
          <form action={acceptDateAction}>
            <input type="hidden" name="token" value={view.token} />
            <button
              type="submit"
              className="cj-btn-primary"
              disabled={acceptDatePending}
            >
              {acceptDatePending
                ? "Saving…"
                : view.canAcceptProposal
                  ? "Accept proposal & date"
                  : "Confirm date"}
            </button>
          </form>
          <button
            type="button"
            className="cj-btn-secondary"
            onClick={() => setMode("request_date")}
          >
            Request another date
          </button>
        </div>
      ) : (
        <form action={requestDateAction} className="cj-portal-form">
          <input type="hidden" name="token" value={view.token} />
          <label className="cj-portal-label" htmlFor="request-date-message">
            What dates would work better?
          </label>
          <textarea
            id="request-date-message"
            name="message"
            required
            rows={4}
            className="cj-portal-textarea"
            placeholder="e.g. I’d prefer the week after, or mornings only."
          />
          <div className="cj-portal-form-actions">
            <button
              type="submit"
              className="cj-btn-primary"
              disabled={requestDatePending}
            >
              {requestDatePending ? "Sending…" : "Send date request"}
            </button>
            <button
              type="button"
              className="cj-btn-secondary"
              onClick={() => setMode("idle")}
              disabled={requestDatePending}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
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
