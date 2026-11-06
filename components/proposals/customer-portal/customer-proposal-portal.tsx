"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CustomerPortalConversation } from "@/components/proposals/customer-portal/customer-portal-conversation";
import {
  acceptProposedScheduleDate,
  acceptPublicProposal,
  askPublicProposalQuestion,
  declinePendingDateSuggestion,
  declinePublicProposal,
  holdPublicAvailabilitySlot,
  requestAnotherScheduleDate,
  requestAnotherScheduleTime,
  requestPublicProposalChanges,
  type CustomerPortalActionState,
} from "@/lib/proposals/customer-portal/actions";
import type { PublicProposalViewModel } from "@/lib/proposals/customer-portal/load-public-proposal";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import { PortalAccordion } from "@/components/proposals/customer-portal/portal-accordion";
import {
  PortalIconAccept,
  PortalIconBox,
  PortalIconCalendar,
  PortalIconCard,
  PortalIconChat,
  PortalIconCheck,
  PortalIconClock,
  PortalIconClose,
  PortalIconDoc,
  PortalIconEdit,
  PortalIconHome,
  PortalIconList,
  PortalIconLock,
  PortalIconPlus,
} from "@/components/proposals/customer-portal/portal-icons";
import {
  buildCustomerPortalTimelineStages,
  buildPortalBrandPresentation,
  PORTAL_AVAILABILITY_COPY,
  PORTAL_CHANGE_CHOICES,
  portalPreviewText,
  portalPrimaryActionLabel,
  portalSlotCardCopy,
  portalTodayIsoDate,
  resolvePortalJobImageUrl,
  shouldShowThingsToConfirm,
} from "@/lib/proposals/customer-portal/portal-page-layout";
import type { PublicAvailabilitySlot } from "@/lib/proposals/customer-availability";
import {
  isPortalSlotSelected,
  portalSlotInputId,
  portalSlotRadioValue,
} from "@/lib/proposals/customer-portal/portal-slot-selection";
import { buildCustomerProposalPdfPath } from "@/lib/proposals/customer-portal/token";

const initialState: CustomerPortalActionState = {};

type PortalMode =
  | "idle"
  | "accept"
  | "question"
  | "change_choice"
  | "change_date"
  | "change_time"
  | "change_details"
  | "decline";

function PortalSlotOption({
  slot,
  name,
  checked,
  onSelect,
}: {
  slot: PublicAvailabilitySlot;
  name: string;
  checked: boolean;
  onSelect: (slot: PublicAvailabilitySlot) => void;
}) {
  const copy = portalSlotCardCopy(slot);
  const inputId = portalSlotInputId(name, slot.id);
  return (
    <label
      htmlFor={inputId}
      className={`cj-portal-slot${checked ? " cj-portal-slot-selected" : ""}`}
      onClick={() => onSelect(slot)}
    >
      <span className="cj-portal-slot-inner">
        <input
          id={inputId}
          type="radio"
          name={name}
          value={portalSlotRadioValue(slot)}
          checked={checked}
          onChange={() => onSelect(slot)}
        />
        <span className="cj-portal-slot-copy">
          <span className="cj-portal-slot-title">{copy.title}</span>
          {copy.subtitle ? (
            <span className="cj-portal-slot-subtitle">{copy.subtitle}</span>
          ) : null}
        </span>
      </span>
    </label>
  );
}

function PortalAvailabilityList({
  slots,
  moreSlots,
  name,
  selectedValue,
  matchBy,
  onSelect,
  onRequestTimeframe,
}: {
  slots: PublicAvailabilitySlot[];
  moreSlots: PublicAvailabilitySlot[];
  name: string;
  selectedValue: string;
  matchBy: "id" | "startDate" | "startTime";
  onSelect: (slot: PublicAvailabilitySlot) => void;
  onRequestTimeframe?: () => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const visible = showMore ? [...slots, ...moreSlots] : slots;

  if (slots.length === 0 && moreSlots.length === 0) {
    return (
      <div className="cj-portal-availability-empty">
        <p className="cj-job-copy">{PORTAL_AVAILABILITY_COPY.emptyTitle}</p>
        <p className="cj-portal-muted">{PORTAL_AVAILABILITY_COPY.emptyHint}</p>
        {onRequestTimeframe ? (
          <button
            type="button"
            className="cj-btn-secondary"
            onClick={onRequestTimeframe}
          >
            {PORTAL_AVAILABILITY_COPY.emptyAction}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <p className="cj-portal-availability-heading">
        {PORTAL_AVAILABILITY_COPY.offeredHeading}
      </p>
      <ul className="cj-portal-slot-list">
        {visible.map((slot) => (
            <li key={slot.id}>
              <PortalSlotOption
                slot={slot}
                name={name}
                checked={isPortalSlotSelected(slot, selectedValue, matchBy)}
                onSelect={onSelect}
              />
            </li>
        ))}
      </ul>
      {!showMore && moreSlots.length > 0 ? (
        <button
          type="button"
          className="cj-btn-secondary"
          onClick={() => setShowMore(true)}
        >
          {PORTAL_AVAILABILITY_COPY.showMore}
        </button>
      ) : null}
    </>
  );
}

function PortalCustomDateTimeFields({
  hasOfferedSlots,
  includeDate,
  includeTime,
  requestedDate,
  requestedTime,
  onDateChange,
  onTimeChange,
  messageId,
  messagePlaceholder,
}: {
  hasOfferedSlots: boolean;
  includeDate: boolean;
  includeTime: boolean;
  requestedDate: string;
  requestedTime: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  messageId: string;
  messagePlaceholder: string;
}) {
  const minDate = portalTodayIsoDate();
  return (
    <div className="cj-portal-custom-datetime">
      <p className="cj-portal-custom-datetime-title">
        {hasOfferedSlots
          ? PORTAL_AVAILABILITY_COPY.customHeading
          : PORTAL_AVAILABILITY_COPY.customHeadingWhenEmpty}
      </p>
      <p className="cj-portal-muted">
        {hasOfferedSlots
          ? PORTAL_AVAILABILITY_COPY.customHint
          : PORTAL_AVAILABILITY_COPY.emptyHint}
      </p>
      {includeDate ? (
        <>
          <label className="cj-portal-label" htmlFor={`${messageId}-date`}>
            Preferred date
          </label>
          <input
            id={`${messageId}-date`}
            type="date"
            min={minDate}
            value={requestedDate}
            onChange={(event) => onDateChange(event.target.value)}
            className="cj-portal-input cj-portal-field cj-portal-date-input"
          />
        </>
      ) : null}
      {includeTime ? (
        <>
          <label className="cj-portal-label" htmlFor={`${messageId}-time`}>
            Preferred time
          </label>
          <input
            id={`${messageId}-time`}
            type="time"
            value={requestedTime}
            onChange={(event) => onTimeChange(event.target.value)}
            className="cj-portal-input cj-portal-field cj-portal-time-input"
          />
        </>
      ) : null}
      <label className="cj-portal-label" htmlFor={messageId}>
        Anything else we should know? (optional)
      </label>
      <textarea
        id={messageId}
        name="message"
        rows={3}
        className="cj-portal-textarea"
        placeholder={messagePlaceholder}
      />
    </div>
  );
}

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
  view,
  showHero = true,
}: {
  children: ReactNode;
  view?: Pick<
    PublicProposalViewModel,
    | "businessName"
    | "businessLogoUrl"
    | "proposalNumber"
    | "issuedLabel"
    | "token"
    | "isRevisedQuote"
    | "approvedInvoicePdfPath"
  >;
  showHero?: boolean;
}) {
  const brand = buildPortalBrandPresentation({
    businessName: view?.businessName,
    businessLogoUrl: view?.businessLogoUrl,
  });

  return (
    <div className="cj-root cj-root--portal">
      <div className="cj-page">
        <main className="cj-portal-page">
          {showHero && view ? <PortalHero view={view} /> : null}
          {children}
          <footer className="cj-portal-footer">
            <p>{brand.productFooter}</p>
            <p>
              <PortalIconLock />
              <span>{brand.securityFooter}</span>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

function InvoiceMoneyBreakdown({
  payment,
}: {
  payment: NonNullable<PublicProposalViewModel["payment"]>;
}) {
  if (!payment.invoiceTotalLabel) {
    return null;
  }

  return (
    <dl className="cj-payment-bank">
      <div>
        <dt>Invoice total</dt>
        <dd>{payment.invoiceTotalLabel}</dd>
      </div>
      <div>
        <dt>Already paid</dt>
        <dd>{payment.amountPaidLabel}</dd>
      </div>
      <div>
        <dt>Still to pay</dt>
        <dd>{payment.balanceDueLabel}</dd>
      </div>
    </dl>
  );
}

function PortalPaymentInstructions({
  payment,
}: {
  payment: NonNullable<PublicProposalViewModel["payment"]>;
}) {
  const hasInstructions = Boolean(
    payment.bank ||
      payment.cardUrl ||
      payment.cardInPerson ||
      payment.cash ||
      payment.otherLabel
  );
  if (!hasInstructions) {
    return null;
  }

  return (
    <>
      {payment.methodLabels.length > 0 ? (
        <p className="cj-job-copy">
          Payment method
          <br />
          {payment.methodLabels.join(", ")}
        </p>
      ) : null}
      {payment.bank ? (
        <dl className="cj-payment-bank">
          <div>
            <dt>Account name</dt>
            <dd>{payment.bank.accountName}</dd>
          </div>
          <div>
            <dt>Sort code</dt>
            <dd>{payment.bank.sortCode}</dd>
          </div>
          <div>
            <dt>Account number</dt>
            <dd>{payment.bank.accountNumber}</dd>
          </div>
          {payment.bank.reference ? (
            <div>
              <dt>Payment reference</dt>
              <dd>{payment.bank.reference}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {payment.cardUrl ? (
        <a className="cj-btn-primary" href={payment.cardUrl} rel="noreferrer">
          Pay securely
        </a>
      ) : null}
      {payment.cardInPerson ? (
        <p className="cj-job-copy">Pay by card with your trader</p>
      ) : null}
      {payment.cash ? <p className="cj-job-copy">Cash payment agreed</p> : null}
      {payment.otherLabel ? (
        <p className="cj-job-copy">{payment.otherLabel}</p>
      ) : null}
    </>
  );
}

function PortalPaymentCard({
  payment,
}: {
  payment: PublicProposalViewModel["payment"];
}) {
  if (!payment) {
    return null;
  }

  if (payment.invoiceFiguresUnavailable && payment.status !== "waived") {
    return (
      <section className="cj-job-card" aria-label="Invoice balance unavailable">
        <p className="cj-job-eyebrow">Payment</p>
        <h2 className="cj-job-title">Invoice balance unavailable</h2>
        <p className="cj-job-copy">
          The saved invoice figures do not match, so the amount still to pay is
          not shown.
        </p>
      </section>
    );
  }

  if (payment.status === "paid" || payment.status === "waived") {
    return (
      <section className="cj-job-card" aria-label="Payment">
        <p className="cj-job-eyebrow">Payment</p>
        <h2 className="cj-job-title">
          {payment.status === "waived" ? "No payment required" : "Payment received"}
        </h2>
        <p className="cj-job-copy">
          {payment.status === "waived"
            ? "No payment is required. This does not cancel the invoice."
            : "Thank you. Nothing left to pay."}
        </p>
        {payment.status === "paid" && payment.amountLabel ? (
          <p className="cj-portal-summary-price">{payment.amountLabel}</p>
        ) : null}
        {payment.status === "paid" ? (
          <InvoiceMoneyBreakdown payment={payment} />
        ) : null}
      </section>
    );
  }

  if (payment.status !== "requested" && payment.status !== "partially_paid") {
    return null;
  }

  return (
    <section className="cj-job-card cj-payment-due-card" aria-label="Payment due">
      <p className="cj-job-eyebrow">Payment due</p>
      <h2 className="cj-job-title">
        {payment.status === "partially_paid"
          ? "Part payment received"
          : payment.jobTitle}
      </h2>
      {payment.status === "partially_paid" ? (
        <p className="cj-job-copy">{payment.jobTitle}</p>
      ) : null}
      {payment.amountLabel ? (
        <>
          <p className="cj-job-copy">Still to pay</p>
          <p className="cj-portal-summary-price">{payment.amountLabel}</p>
        </>
      ) : (
        <p className="cj-job-copy">
          A part payment has been recorded. The remaining balance is not
          available on this page yet.
        </p>
      )}
      <InvoiceMoneyBreakdown payment={payment} />
      <PortalPaymentInstructions payment={payment} />
    </section>
  );
}

function PortalHero({
  view,
}: {
  view: Pick<
    PublicProposalViewModel,
    | "businessName"
    | "businessLogoUrl"
    | "proposalNumber"
    | "issuedLabel"
    | "token"
    | "isRevisedQuote"
    | "approvedInvoicePdfPath"
  >;
}) {
  const brand = buildPortalBrandPresentation({
    businessName: view.businessName,
    businessLogoUrl: view.businessLogoUrl,
  });

  return (
    <header className="cj-portal-hero-wrap">
      <div className="cj-portal-hero-main">
        <div className="cj-portal-hero-identity">
          <div className="cj-portal-logo-mark">
            {brand.showLogo && brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt={brand.heroName} />
            ) : (
              <PortalIconHome />
            )}
          </div>
          <div>
            <h1 className="cj-portal-business-name">{brand.heroName}</h1>
            <p className="cj-portal-brand-subtitle">{brand.subtitle}</p>
          </div>
        </div>
        <p className="cj-portal-hero-intro">{brand.intro}</p>
      </div>
      <aside className="cj-portal-ref">
        <p className="cj-portal-ref-label">
          <PortalIconDoc />
          Proposal Ref
        </p>
        <p className="cj-portal-ref-number">#{view.proposalNumber}</p>
        {view.issuedLabel ? (
          <p className="cj-portal-ref-issued">Issued: {view.issuedLabel}</p>
        ) : null}
        {view.isRevisedQuote ? (
          <p className="cj-portal-revised-badge">Updated quote</p>
        ) : null}
        <div className="cj-portal-pdf-links">
          <a
            className="cj-portal-pdf-quiet"
            href={buildCustomerProposalPdfPath(view.token)}
          >
            Download quotation PDF
          </a>
          {view.approvedInvoicePdfPath ? (
            <a className="cj-portal-pdf-quiet" href={view.approvedInvoicePdfPath}>
              Download invoice PDF
            </a>
          ) : null}
        </div>
      </aside>
    </header>
  );
}

export function CustomerProposalPortal({
  view,
  messages = [],
  openConversation = false,
}: {
  view: PublicProposalViewModel;
  messages?: ProposalCustomerMessage[];
  openConversation?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<PortalMode>("idle");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
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
  const [requestTimeState, requestTimeAction, requestTimePending] =
    useActionState(requestAnotherScheduleTime, initialState);
  const [holdState, holdAction, holdPending] = useActionState(
    holdPublicAvailabilitySlot,
    initialState
  );
  const [declineState, declineAction, declinePending] = useActionState(
    declinePublicProposal,
    initialState
  );
  const [
    declineSuggestionState,
    declineSuggestionAction,
    declineSuggestionPending,
  ] = useActionState(declinePendingDateSuggestion, initialState);

  const successResult =
    acceptState.result ||
    questionState.result ||
    changesState.result ||
    acceptDateState.result ||
    requestDateState.result ||
    requestTimeState.result ||
    declineSuggestionState.result ||
    declineState.result;
  const error =
    acceptState.error ||
    questionState.error ||
    changesState.error ||
    acceptDateState.error ||
    requestDateState.error ||
    requestTimeState.error ||
    holdState.error ||
    declineSuggestionState.error ||
    declineState.error ||
    null;

  useEffect(() => {
    if (
      questionState.ok ||
      changesState.ok ||
      acceptState.ok ||
      acceptDateState.ok ||
      requestDateState.ok ||
      requestTimeState.ok ||
      holdState.ok ||
      declineSuggestionState.ok ||
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
    requestTimeState.ok,
    holdState.ok,
    declineSuggestionState.ok,
    declineState.ok,
    router,
  ]);

  if (successResult === "declined" || view.isDeclined) {
    return (
      <PortalShell view={view}>
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
      <PortalShell view={view}>
        <section className="cj-job-card">
          <h1 className="cj-job-title">Proposal unavailable</h1>
          <p className="cj-job-copy">
            This proposal is no longer open. Please contact {view.businessName}{" "}
            if you need help.
          </p>
        </section>
      </PortalShell>
    );
  }

  if (successResult === "accepted" || view.isAccepted) {
    const showBookedChangeSuccess =
      successResult === "date_change_requested" ||
      view.scheduleChangeRequestPending;
    const keptConfirmedBooking =
      successResult === "date_suggestion_declined";
    return (
      <PortalShell view={view}>
        <section className="cj-job-card cj-portal-success">
          <p className="cj-job-eyebrow">
            {view.isJobClosed ? "Job closed" : "Accepted"}
          </p>
          <h1 className="cj-job-title">
            {view.isJobClosed ? "Job closed" : "Thank you"}
          </h1>
          <p className="cj-job-copy">
            {view.isJobClosed
              ? view.payment?.status === "paid"
                ? "Payment received. This job is now closed."
                : "This job is now closed."
              : `Your proposal and booking are confirmed${
                  view.plannedStartLabel ? ` for ${view.plannedStartLabel}` : ""
                }.`}
          </p>
          {keptConfirmedBooking ? (
            <p className="cj-job-copy" role="status">
              You kept your current confirmed booking. No changes were made.
            </p>
          ) : null}
          <div className="cj-portal-pdf-links">
            <a
              className="cj-btn-secondary cj-portal-pdf"
              href={buildCustomerProposalPdfPath(view.token)}
            >
              Download quotation PDF
            </a>
            {view.approvedInvoicePdfPath ? (
              <a
                className="cj-btn-secondary cj-portal-pdf"
                href={view.approvedInvoicePdfPath}
              >
                Download invoice PDF
              </a>
            ) : null}
          </div>
        </section>
        {showBookedChangeSuccess ? (
          <section className="cj-job-card" role="status">
            <p className="cj-job-eyebrow">Sent</p>
            <h2 className="cj-job-section-title">
              {PORTAL_AVAILABILITY_COPY.bookedChangePendingTitle}
            </h2>
            <p className="cj-job-copy">
              {PORTAL_AVAILABILITY_COPY.bookedChangePendingCopy}
            </p>
          </section>
        ) : null}
        {error && (view.canRequestScheduleChange || mode === "change_date") ? (
          <p className="cj-portal-error" role="alert">
            {error}
          </p>
        ) : null}
        <PortalPaymentCard payment={view.payment} />
        {view.canRespondToProposedDate &&
        view.proposedDateLabel &&
        !view.canAcceptProposal ? (
          <ProposedBookingCard
            view={view}
            error={error}
            mode={mode}
            setMode={setMode}
            requestedDate={requestedDate}
            requestedTime={requestedTime}
            onRequestedDateChange={setRequestedDate}
            onRequestedTimeChange={setRequestedTime}
            acceptDateAction={acceptDateAction}
            acceptDatePending={acceptDatePending}
            requestDateAction={requestDateAction}
            requestDatePending={requestDatePending}
            declineSuggestionAction={declineSuggestionAction}
            declineSuggestionPending={declineSuggestionPending}
          />
        ) : null}
        {!view.isJobClosed &&
        view.canRequestScheduleChange &&
        !view.canRespondToProposedDate ? (
          <BookedScheduleChangeCard
            view={view}
            mode={mode}
            setMode={setMode}
            requestedDate={requestedDate}
            requestedTime={requestedTime}
            onRequestedDateChange={setRequestedDate}
            onRequestedTimeChange={setRequestedTime}
            requestDateAction={requestDateAction}
            requestDatePending={requestDatePending}
          />
        ) : null}
        <CustomerPortalConversation
          token={view.token}
          messages={messages}
          canReply={view.canMessage}
          businessName={view.businessName}
          openConversation={openConversation}
        />
        <ProposalBody view={view} />
      </PortalShell>
    );
  }

  if (successResult === "date_accepted") {
    return (
      <PortalShell view={view}>
        <section className="cj-job-card cj-portal-success">
          <p className="cj-job-eyebrow">Date confirmed</p>
          <h1 className="cj-job-title">Thank you</h1>
          <p className="cj-job-copy">
            You’ve confirmed
            {view.plannedStartLabel ? ` ${view.plannedStartLabel}` : " this date"}
            .
          </p>
        </section>
        <CustomerPortalConversation
          token={view.token}
          messages={messages}
          canReply={view.canMessage}
          businessName={view.businessName}
          openConversation={openConversation}
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
      <PortalShell view={view}>
        <section className="cj-job-card cj-portal-success">
          <p className="cj-job-eyebrow">Sent</p>
          <h1 className="cj-job-title">
            {successResult === "question"
              ? "Question sent"
              : successResult === "date_change_requested"
                ? "Change requested"
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
          canReply={view.canMessage}
          businessName={view.businessName}
          openConversation={openConversation}
        />
        <ProposalBody view={view} />
      </PortalShell>
    );
  }

  const primaryLabel =
    view.dateOfferSource === "trader" && view.canAcceptProposal
      ? "Accept proposal & date"
      : portalPrimaryActionLabel(view.canAcceptProposal);

  return (
    <PortalShell view={view}>
      <JobSummaryCard view={view} />
      <ProposalBody view={view} />

      {view.canRespondToProposedDate &&
      view.proposedDateLabel &&
      !view.canAcceptProposal ? (
        <ProposedBookingCard
          view={view}
          error={error}
          mode={mode}
          setMode={setMode}
          requestedDate={requestedDate}
          requestedTime={requestedTime}
          onRequestedDateChange={setRequestedDate}
          onRequestedTimeChange={setRequestedTime}
          acceptDateAction={acceptDateAction}
          acceptDatePending={acceptDatePending}
          requestDateAction={requestDateAction}
          requestDatePending={requestDatePending}
          declineSuggestionAction={declineSuggestionAction}
          declineSuggestionPending={declineSuggestionPending}
        />
      ) : null}

      <CustomerPortalConversation
        token={view.token}
        messages={messages}
        canReply={view.canMessage}
        businessName={view.businessName}
        openConversation={openConversation}
      />

      <ProposalTimelineCard view={view} />

      {view.canRespond ? (
        <section className="cj-portal-respond">
          <h2 className="cj-portal-respond-title">Ready to respond?</h2>
          <p className="cj-portal-respond-copy">
            {view.revisionBlocksAccept
              ? "An updated quote is being prepared. You can send a message, but acceptance is paused until the new quote is ready."
              : view.canAcceptProposal
                ? view.isRevisedQuote
                  ? "This is the updated quote. Choose an option below once you are happy with the new total."
                  : "Choose one of the options below to let us know how you'd like to proceed."
                : "Choose an available date before you can accept this proposal."}
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
                <PortalIconAccept />
                {primaryLabel}
              </button>
              <button
                type="button"
                className="cj-btn-secondary"
                onClick={() => setMode("change_choice")}
              >
                <PortalIconEdit />
                Request a change
              </button>
              <button
                type="button"
                className="cj-btn-secondary"
                onClick={() => setMode("question")}
              >
                <PortalIconChat />
                Ask a question
              </button>
              <button
                type="button"
                className="cj-btn-secondary cj-portal-action-decline"
                onClick={() => setMode("decline")}
              >
                <PortalIconClose />
                Decline
              </button>
            </div>
          ) : null}

          {mode === "change_choice" ? (
            <div className="cj-portal-form">
              <h3 className="cj-portal-choice-title">What would you like to change?</h3>
              <div className="cj-portal-action-row">
                {PORTAL_CHANGE_CHOICES.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className="cj-btn-secondary"
                    onClick={() =>
                      setMode(
                        choice.id === "date"
                          ? "change_date"
                          : choice.id === "time"
                            ? "change_time"
                            : "change_details"
                      )
                    }
                  >
                    {choice.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="cj-btn-secondary"
                  onClick={() => setMode("idle")}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {mode === "accept" && view.canAcceptProposal ? (
            <form action={acceptAction} className="cj-portal-form">
              <input type="hidden" name="token" value={view.token} />
              <input
                type="hidden"
                name="expectedContentRevision"
                value={String(view.contentRevision)}
              />
              <p className="cj-job-copy">
                You’re happy to go ahead at <strong>{view.priceLabel}</strong>
                {view.isRevisedQuote ? " (updated quote)" : ""}
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
                  {acceptPending ? "Accepting…" : primaryLabel}
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
              <input
                type="hidden"
                name="expectedContentRevision"
                value={String(view.contentRevision)}
              />
              <p className="cj-job-copy">
                {view.scheduleMode === "range"
                  ? "Choose a date range that fits the work."
                  : "Choose one available appointment."}
              </p>
              <PortalAvailabilityList
                slots={view.availabilitySlots}
                moreSlots={view.moreAvailabilitySlots}
                name="slotId"
                selectedValue={selectedSlotId}
                matchBy="id"
                onSelect={(next) => {
                  setSelectedSlotId(next.id);
                  const data = new FormData();
                  data.set("token", view.token);
                  data.set("slotId", next.id);
                  holdAction(data);
                }}
                onRequestTimeframe={() => setMode("change_date")}
              />
              {view.availabilitySlots.length > 0 ||
              view.moreAvailabilitySlots.length > 0 ? (
                <button
                  type="button"
                  className="cj-btn-secondary"
                  onClick={() => setMode("change_date")}
                  disabled={acceptPending}
                >
                  {PORTAL_AVAILABILITY_COPY.customHeading}
                </button>
              ) : null}
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
                  onClick={() => setMode("change_choice")}
                  disabled={acceptPending}
                >
                  Request a change
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

          {mode === "change_date" ? (
            <form action={requestDateAction} className="cj-portal-form">
              <input type="hidden" name="token" value={view.token} />
              <input type="hidden" name="changeFocus" value="date" />
              <input type="hidden" name="requestedDate" value={requestedDate} />
              <input type="hidden" name="requestedTime" value={requestedTime} />
              <p className="cj-job-copy">
                Pick an offered appointment, or request a date and time that
                works for you. This is a request — your builder will confirm.
              </p>
              <PortalAvailabilityList
                slots={view.availabilitySlots}
                moreSlots={view.moreAvailabilitySlots}
                name="availableDate"
                selectedValue={requestedDate}
                matchBy="startDate"
                onSelect={(next) => {
                  setRequestedDate(next.startDate);
                  setRequestedTime(next.startTime || "");
                }}
              />
              <PortalCustomDateTimeFields
                hasOfferedSlots={
                  view.availabilitySlots.length > 0 ||
                  view.moreAvailabilitySlots.length > 0
                }
                includeDate
                includeTime
                requestedDate={requestedDate}
                requestedTime={requestedTime}
                onDateChange={setRequestedDate}
                onTimeChange={setRequestedTime}
                messageId="request-date-message"
                messagePlaceholder="e.g. The week after works better."
              />
              <div className="cj-portal-form-actions">
                <button
                  type="submit"
                  className="cj-btn-primary"
                  disabled={requestDatePending}
                >
                  {requestDatePending
                    ? "Sending…"
                    : PORTAL_AVAILABILITY_COPY.requestDateButton}
                </button>
                <button
                  type="button"
                  className="cj-btn-secondary"
                  onClick={() => setMode("change_choice")}
                  disabled={requestDatePending}
                >
                  Back
                </button>
              </div>
            </form>
          ) : null}

          {mode === "change_time" ? (
            <form action={requestTimeAction} className="cj-portal-form">
              <input type="hidden" name="token" value={view.token} />
              <input type="hidden" name="changeFocus" value="time" />
              <input type="hidden" name="requestedTime" value={requestedTime} />
              <p className="cj-job-copy">
                Pick an offered time, or request a time that works for you. This
                is a request — your builder will confirm.
              </p>
              <PortalAvailabilityList
                slots={view.availabilitySlots.filter((slot) => slot.startTime)}
                moreSlots={view.moreAvailabilitySlots.filter((slot) => slot.startTime)}
                name="availableTime"
                selectedValue={requestedTime}
                matchBy="startTime"
                onSelect={(next) => setRequestedTime(next.startTime || "")}
              />
              <PortalCustomDateTimeFields
                hasOfferedSlots={
                  view.availabilitySlots.some((slot) => slot.startTime) ||
                  view.moreAvailabilitySlots.some((slot) => slot.startTime)
                }
                includeDate={false}
                includeTime
                requestedDate={requestedDate}
                requestedTime={requestedTime}
                onDateChange={setRequestedDate}
                onTimeChange={setRequestedTime}
                messageId="request-time-message"
                messagePlaceholder="e.g. Mornings are better."
              />
              <div className="cj-portal-form-actions">
                <button
                  type="submit"
                  className="cj-btn-primary"
                  disabled={requestTimePending}
                >
                  {requestTimePending
                    ? "Sending…"
                    : PORTAL_AVAILABILITY_COPY.requestTimeButton}
                </button>
                <button
                  type="button"
                  className="cj-btn-secondary"
                  onClick={() => setMode("change_choice")}
                  disabled={requestTimePending}
                >
                  Back
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

          {mode === "change_details" ? (
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
                placeholder="Scope, materials, quantities, extras, or other job details…"
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
                  onClick={() => setMode("change_choice")}
                  disabled={changesPending}
                >
                  Back
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
                  className="cj-btn-primary cj-portal-action-decline-confirm"
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
        <section className="cj-portal-respond">
          <h2 className="cj-portal-respond-title">Response</h2>
          <p className="cj-portal-respond-copy">
            This proposal isn’t open for a new response right now. Contact{" "}
            {view.businessName} if you need help.
          </p>
        </section>
      )}
    </PortalShell>
  );
}

function BookedScheduleChangeCard({
  view,
  mode,
  setMode,
  requestedDate,
  requestedTime,
  onRequestedDateChange,
  onRequestedTimeChange,
  requestDateAction,
  requestDatePending,
}: {
  view: PublicProposalViewModel;
  mode: PortalMode;
  setMode: (mode: PortalMode) => void;
  requestedDate: string;
  requestedTime: string;
  onRequestedDateChange: (value: string) => void;
  onRequestedTimeChange: (value: string) => void;
  requestDateAction: (payload: FormData) => void;
  requestDatePending: boolean;
}) {
  const hasOfferedSlots =
    view.availabilitySlots.length > 0 || view.moreAvailabilitySlots.length > 0;

  return (
    <section className="cj-job-card cj-portal-actions" aria-label="Request a booking change">
      <h2 className="cj-job-section-title">
        {PORTAL_AVAILABILITY_COPY.bookedChangeTitle}
      </h2>
      <p className="cj-job-copy">{PORTAL_AVAILABILITY_COPY.bookedChangeHint}</p>
      {view.plannedStartLabel ? (
        <p className="cj-job-copy">
          Current booking: <strong>{view.plannedStartLabel}</strong>
        </p>
      ) : null}

      {mode !== "change_date" ? (
        <div className="cj-portal-action-row">
          <button
            type="button"
            className="cj-btn-primary"
            onClick={() => setMode("change_date")}
          >
            {PORTAL_AVAILABILITY_COPY.bookedChangeButton}
          </button>
        </div>
      ) : (
        <form action={requestDateAction} className="cj-portal-form">
          <input type="hidden" name="token" value={view.token} />
          <input type="hidden" name="changeFocus" value="date" />
          <input type="hidden" name="requestedDate" value={requestedDate} />
          <input type="hidden" name="requestedTime" value={requestedTime} />
          <p className="cj-job-copy">
            Pick an offered appointment, or request a date and time that works
            for you. This is a request — your current booking stays confirmed
            until {view.businessName} agrees a change.
          </p>
          <PortalAvailabilityList
            slots={view.availabilitySlots}
            moreSlots={view.moreAvailabilitySlots}
            name="availableDateBooked"
            selectedValue={requestedDate}
            matchBy="startDate"
            onSelect={(next) => {
              onRequestedDateChange(next.startDate);
              onRequestedTimeChange(next.startTime || "");
            }}
          />
          <PortalCustomDateTimeFields
            hasOfferedSlots={hasOfferedSlots}
            includeDate
            includeTime
            requestedDate={requestedDate}
            requestedTime={requestedTime}
            onDateChange={onRequestedDateChange}
            onTimeChange={onRequestedTimeChange}
            messageId="request-date-message-booked"
            messagePlaceholder="e.g. The week after works better."
          />
          <div className="cj-portal-form-actions">
            <button
              type="submit"
              className="cj-btn-primary"
              disabled={requestDatePending}
            >
              {requestDatePending
                ? "Sending…"
                : PORTAL_AVAILABILITY_COPY.requestDateButton}
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

function ProposedBookingCard({
  view,
  error,
  mode,
  setMode,
  requestedDate,
  requestedTime,
  onRequestedDateChange,
  onRequestedTimeChange,
  acceptDateAction,
  acceptDatePending,
  requestDateAction,
  requestDatePending,
  declineSuggestionAction,
  declineSuggestionPending,
}: {
  view: PublicProposalViewModel;
  error: string | null;
  mode: PortalMode;
  setMode: (mode: PortalMode) => void;
  requestedDate: string;
  requestedTime: string;
  onRequestedDateChange: (value: string) => void;
  onRequestedTimeChange: (value: string) => void;
  acceptDateAction: (payload: FormData) => void;
  acceptDatePending: boolean;
  requestDateAction: (payload: FormData) => void;
  requestDatePending: boolean;
  declineSuggestionAction: (payload: FormData) => void;
  declineSuggestionPending: boolean;
}) {
  const hasOfferedSlots =
    view.availabilitySlots.length > 0 || view.moreAvailabilitySlots.length > 0;
  const pendingAlternative = view.hasPendingDateSuggestion;

  return (
    <section className="cj-job-card cj-portal-actions">
      {pendingAlternative && view.confirmedBookingLabel ? (
        <>
          <h2 className="cj-job-section-title">
            {PORTAL_AVAILABILITY_COPY.confirmedBookingHeading}
          </h2>
          <p className="cj-job-copy">
            <strong>{view.confirmedBookingLabel}</strong>
          </p>
          <h2 className="cj-job-section-title">
            {PORTAL_AVAILABILITY_COPY.proposedAlternativeHeading}
          </h2>
          <p className="cj-job-copy">
            <strong>{view.proposedDateLabel}</strong>
          </p>
          <p className="cj-job-copy">
            {PORTAL_AVAILABILITY_COPY.proposedAlternativeHint}
          </p>
        </>
      ) : (
        <>
          <h2 className="cj-job-section-title">Proposed booking</h2>
          <p className="cj-job-copy">
            <strong>{view.proposedDateLabel}</strong>
          </p>
          <p className="cj-job-copy">
            {view.canAcceptProposal
              ? "New date proposed. Accept the proposal and this date together, or request another date."
              : "Confirm this date if it works, or request another date."}
          </p>
        </>
      )}

      {error ? (
        <p className="cj-portal-error" role="alert">
          {error}
        </p>
      ) : null}

      {mode !== "change_date" ? (
        <div className="cj-portal-action-row">
          <form action={acceptDateAction}>
            <input type="hidden" name="token" value={view.token} />
            <button
              type="submit"
              className="cj-btn-primary"
              disabled={acceptDatePending || declineSuggestionPending}
            >
              {acceptDatePending
                ? "Saving…"
                : view.canAcceptProposal
                  ? "Accept proposal & date"
                  : pendingAlternative
                    ? "Accept new date"
                    : "Confirm date"}
            </button>
          </form>
          {pendingAlternative ? (
            <form action={declineSuggestionAction}>
              <input type="hidden" name="token" value={view.token} />
              <button
                type="submit"
                className="cj-btn-secondary"
                disabled={acceptDatePending || declineSuggestionPending}
              >
                {declineSuggestionPending
                  ? "Saving…"
                  : PORTAL_AVAILABILITY_COPY.keepConfirmedBookingButton}
              </button>
            </form>
          ) : null}
          <button
            type="button"
            className="cj-btn-secondary"
            onClick={() => setMode("change_date")}
            disabled={acceptDatePending || declineSuggestionPending}
          >
            Request a change
          </button>
        </div>
      ) : (
        <form action={requestDateAction} className="cj-portal-form">
          <input type="hidden" name="token" value={view.token} />
          <input type="hidden" name="changeFocus" value="date" />
          <input type="hidden" name="requestedDate" value={requestedDate} />
          <input type="hidden" name="requestedTime" value={requestedTime} />
          <p className="cj-job-copy">
            Pick an offered appointment, or request a date and time that works
            for you. This is a request — your builder will confirm.
          </p>
          <PortalAvailabilityList
            slots={view.availabilitySlots}
            moreSlots={view.moreAvailabilitySlots}
            name="availableDateProposed"
            selectedValue={requestedDate}
            matchBy="startDate"
            onSelect={(next) => {
              onRequestedDateChange(next.startDate);
              onRequestedTimeChange(next.startTime || "");
            }}
          />
          <PortalCustomDateTimeFields
            hasOfferedSlots={hasOfferedSlots}
            includeDate
            includeTime
            requestedDate={requestedDate}
            requestedTime={requestedTime}
            onDateChange={onRequestedDateChange}
            onTimeChange={onRequestedTimeChange}
            messageId="request-date-message-proposed"
            messagePlaceholder="e.g. I’d prefer the week after, or mornings only."
          />
          <div className="cj-portal-form-actions">
            <button
              type="submit"
              className="cj-btn-primary"
              disabled={requestDatePending}
            >
              {requestDatePending
                ? "Sending…"
                : PORTAL_AVAILABILITY_COPY.requestDateButton}
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

function JobSummaryCard({ view }: { view: PublicProposalViewModel }) {
  const imageUrl = resolvePortalJobImageUrl(view.jobImageUrl);

  return (
    <section className="cj-portal-summary-card">
      <div className="cj-portal-summary-top">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="cj-portal-summary-image"
            src={imageUrl}
            alt=""
          />
        ) : null}
        <div>
          <h2 className="cj-portal-summary-title">{view.title}</h2>
          {view.isRevisedQuote ? (
            <p className="cj-portal-revised-notice">
              This is an updated quote. Please review the new total and details
              before accepting.
            </p>
          ) : null}
          <p className="cj-portal-summary-copy">{view.projectSummary}</p>
          {view.priceLabel ? (
            <p className="cj-portal-summary-price">{view.priceLabel}</p>
          ) : null}
        </div>
      </div>
      {view.plannedDateLabel || view.plannedTimeLabel || view.estimatedDuration ? (
        <dl className="cj-portal-summary-metrics">
          {view.plannedDateLabel ? (
            <div>
              <dt>
                <PortalIconCalendar />
                Proposed date
              </dt>
              <dd>{view.plannedDateLabel}</dd>
            </div>
          ) : null}
          {view.plannedTimeLabel ? (
            <div>
              <dt>
                <PortalIconClock />
                Start time
              </dt>
              <dd>{view.plannedTimeLabel}</dd>
            </div>
          ) : null}
          {view.estimatedDuration ? (
            <div>
              <dt>
                <PortalIconClock />
                Estimated duration
              </dt>
              <dd>{view.estimatedDuration}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}

function ProposalTimelineCard({ view }: { view: PublicProposalViewModel }) {
  const timeline = buildCustomerPortalTimelineStages({
    issuedLabel: view.issuedLabel,
    status: view.status,
    isAccepted: view.isAccepted,
    isDeclined: view.isDeclined,
  });
  if (timeline.length === 0) {
    return null;
  }

  return (
    <section className="cj-portal-accordion-card">
      <PortalAccordion
        title="Proposal timeline"
        preview="See the key stages of your proposal"
        icon={<PortalIconClock />}
      >
        <ol className="cj-portal-timeline">
          {timeline.map((stage) => (
            <li
              key={stage.id}
              className={
                stage.current ? "cj-portal-timeline-current" : undefined
              }
            >
              <p className="cj-portal-timeline-label">{stage.label}</p>
              {stage.detail ? (
                <p className="cj-portal-timeline-detail">{stage.detail}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </PortalAccordion>
    </section>
  );
}

function ProposalBody({ view }: { view: PublicProposalViewModel }) {
  const showThingsToConfirm = shouldShowThingsToConfirm(view.beforeWorkBegins);

  return (
    <>
      <section className="cj-portal-accordion-card">
        <PortalAccordion
          title="Project summary"
          preview={portalPreviewText(
            view.projectSummary,
            "Overview of the work in this proposal."
          )}
          icon={<PortalIconDoc />}
        >
          <p className="cj-job-copy">{view.projectSummary}</p>
        </PortalAccordion>
      </section>

      <section className="cj-portal-accordion-card">
        <PortalAccordion
          title="Scope of work"
          preview={portalPreviewText(
            view.scopeOfWork[0],
            "Full details of the work to be carried out."
          )}
          icon={<PortalIconList />}
        >
          <BulletList items={view.scopeOfWork} />
        </PortalAccordion>
      </section>

      {view.materials.length > 0 ? (
        <section className="cj-portal-accordion-card">
          <PortalAccordion
            title="Materials"
            preview={portalPreviewText(
              view.materials[0],
              "Key materials and products included in this proposal."
            )}
            icon={<PortalIconBox />}
          >
            <BulletList items={view.materials} />
          </PortalAccordion>
        </section>
      ) : null}

      {view.optionalExtras.length > 0 ? (
        <section className="cj-portal-accordion-card">
          <PortalAccordion
            title="Optional extras"
            preview={portalPreviewText(
              view.optionalExtras[0],
              "Additional items you may wish to include."
            )}
            icon={<PortalIconPlus />}
          >
            <BulletList items={view.optionalExtras} />
          </PortalAccordion>
        </section>
      ) : null}

      {view.paymentTerms ? (
        <section className="cj-portal-accordion-card">
          <PortalAccordion
            title="Payment terms"
            preview={portalPreviewText(
              view.paymentTerms,
              "How and when payment will be made."
            )}
            icon={<PortalIconCard />}
          >
            <p className="cj-job-copy">{view.paymentTerms}</p>
            <p className="cj-portal-summary-price">{view.priceLabel}</p>
          </PortalAccordion>
        </section>
      ) : null}

      {showThingsToConfirm ? (
        <section className="cj-portal-accordion-card">
          <PortalAccordion
            title="Things to confirm"
            preview={portalPreviewText(
              view.beforeWorkBegins[0],
              "Items still to confirm before work begins."
            )}
            icon={<PortalIconCheck />}
          >
            <BulletList items={view.beforeWorkBegins} />
          </PortalAccordion>
        </section>
      ) : null}
    </>
  );
}
