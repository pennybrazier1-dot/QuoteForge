"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createProposalFromPreparedQuote,
  type CreateProposalFromPreparedQuoteState,
} from "@/app/proposals/actions";
import { AuthError } from "@/components/auth/auth-shell";
import { GeneratedProposalPreview } from "@/components/proposals/generated-proposal-preview";
import { QuotePreparationReview } from "@/components/proposals/quote-preparation-review";
import {
  getSiteVisitForEnquiryAction,
  markQuoteInPreparationAction,
  markQuotePreparationStartedAction,
} from "@/lib/enquiries/server/actions";
import { useWorkspaceEnquiry } from "@/lib/enquiries/server/use-workspace-enquiries";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { parsePriceToPence } from "@/lib/proposals/money";
import { buildQuotePreparationDraftSafe } from "@/lib/proposals/quote-preparation/build-quote-draft";
import {
  getLocalProposalDraftByEnquiry,
  saveLocalProposalDraft,
} from "@/lib/proposals/quote-preparation/local-proposal-drafts";
import { mapQuoteDraftToGeneratedProposal } from "@/lib/proposals/quote-preparation/map-to-generated-proposal";
import {
  QUOTE_PREPARATION_CREATE_BUTTON,
  QUOTE_PREPARATION_CREATE_HINT,
  QUOTE_PREPARATION_LOCAL_SAVE_BUTTON,
  QUOTE_PREPARATION_LOCAL_SAVE_HINT,
  QUOTE_PREPARATION_LOCAL_SAVE_SUCCESS,
  type QuotePreparationDraft,
} from "@/lib/proposals/quote-preparation/types";
import { DEFAULT_BOOKING_WINDOW } from "@/lib/proposals/booking-window";
import type { SiteVisitSession } from "@/lib/site-visit/types";

const initialCreateState: CreateProposalFromPreparedQuoteState = {};

function CreateProposalSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="qf-btn-primary qf-touch-target-comfortable"
      disabled={disabled || pending}
    >
      {pending ? "Creating proposal…" : QUOTE_PREPARATION_CREATE_BUTTON}
    </button>
  );
}

export function QuotePreparationForm({ enquiryId }: { enquiryId: string }) {
  const mounted = useClientMounted();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const preparationStartedFor = useRef<string | null>(null);
  const { enquiry, state, error, refresh } = useWorkspaceEnquiry(enquiryId);
  const [siteVisit, setSiteVisit] = useState<
    (SiteVisitSession & { id: string }) | null | undefined
  >(undefined);
  const [editedDraft, setEditedDraft] = useState<{
    enquiryId: string;
    draft: QuotePreparationDraft;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [createState, createAction] = useActionState(
    createProposalFromPreparedQuote,
    initialCreateState
  );

  useEffect(() => {
    if (!mounted || !enquiryId || state !== "ready" || !enquiry) {
      return;
    }

    void getSiteVisitForEnquiryAction(enquiryId).then((result) => {
      if (result.ok) {
        setSiteVisit(result.data);
      } else {
        setSiteVisit(null);
      }
    });
  }, [mounted, enquiryId, state, enquiry]);

  useEffect(() => {
    if (!mounted || preparationStartedFor.current === enquiryId || state !== "ready") {
      return;
    }

    if (!enquiry) {
      return;
    }

    preparationStartedFor.current = enquiryId;
    void markQuotePreparationStartedAction(enquiryId);
  }, [mounted, enquiryId, state, enquiry]);

  const baseDraft =
    enquiry && siteVisit !== undefined
      ? (() => {
          const existing = getLocalProposalDraftByEnquiry(enquiryId);
          if (existing?.draft?.enquiryId === enquiryId) {
            return existing.draft;
          }

          return buildQuotePreparationDraftSafe(enquiry, siteVisit);
        })()
      : null;

  const draft =
    editedDraft?.enquiryId === enquiryId ? editedDraft.draft : baseDraft;

  if (!mounted || state === "loading" || (state === "ready" && siteVisit === undefined)) {
    return <p className="qf-quote-prep-loading">Loading quote preparation…</p>;
  }

  if (state === "error") {
    return (
      <div className="qf-quote-prep-empty">
        <h1 className="qf-proposal-title">Could not load enquiry</h1>
        <p className="qf-proposal-subtitle">{error ?? "Something went wrong."}</p>
        <button type="button" className="qf-btn-secondary" onClick={() => void refresh()}>
          Try again
        </button>
      </div>
    );
  }

  if (!enquiry || !draft) {
    return (
      <div className="qf-quote-prep-empty">
        <h1 className="qf-proposal-title">Quote preparation unavailable</h1>
        <p className="qf-proposal-subtitle">
          This enquiry could not be found in your workspace. Open it again from
          Enquiries, or complete the site visit first, then try Prepare Quote once
          more.
        </p>
        <Link href={`/enquiries/${enquiryId}`} className="qf-btn-secondary">
          Back to enquiry
        </Link>
      </div>
    );
  }

  if (enquiry.linkedProposalId) {
    return (
      <div className="qf-quote-prep-empty">
        <h1 className="qf-proposal-title">Proposal already created</h1>
        <p className="qf-proposal-subtitle">
          This enquiry already has an official proposal. Open it to review or send
          it to the customer.
        </p>
        <div className="qf-quote-prep-sticky-actions qf-quote-prep-sticky-actions-inline">
          <Link
            href={`/proposals/${enquiry.linkedProposalId}`}
            className="qf-btn-primary qf-touch-target-comfortable"
          >
            Open proposal
          </Link>
          <Link
            href={`/enquiries/${enquiryId}`}
            className="qf-btn-secondary qf-touch-target-comfortable"
          >
            Back to enquiry
          </Link>
        </div>
      </div>
    );
  }

  async function handleSaveDraft() {
    if (!draft || draft.enquiryId !== enquiryId) {
      setNotice(
        "This draft does not match the current enquiry. Go back and open Prepare Quote again."
      );
      return;
    }

    const saved = saveLocalProposalDraft(draft);
    const result = await markQuoteInPreparationAction(enquiryId, saved.id);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }

    setNotice(QUOTE_PREPARATION_LOCAL_SAVE_SUCCESS);
  }

  function handleDraftChange(next: QuotePreparationDraft) {
    setEditedDraft({ enquiryId, draft: next });
  }

  const previewProposal = mapQuoteDraftToGeneratedProposal(draft);
  const hasValidPrice = parsePriceToPence(draft.total) !== null;
  const bookingWindow = draft.bookingWindow ?? DEFAULT_BOOKING_WINDOW;
  const previewVisible = isDesktop || showPreview;

  return (
    <div className="qf-trader-page qf-quote-prep-page qf-mobile-form-page qf-mobile-safe">
      <header className="qf-proposal-header">
        <h1 className="qf-proposal-title">Prepare Quote</h1>
        <p className="qf-proposal-subtitle">
          Review the organised draft from the enquiry and site visit. Add your
          own prices, preview, then create the official proposal when you are
          ready.
        </p>
        <p className="qf-quote-prep-local-hint">{QUOTE_PREPARATION_LOCAL_SAVE_HINT}</p>
      </header>

      {notice ? (
        <p className="qf-quote-prep-notice-banner" role="status">
          {notice}
        </p>
      ) : null}

      {createState.error ? <AuthError message={createState.error} /> : null}

      <div className="qf-quote-prep-layout">
        <QuotePreparationReview
          draft={draft}
          onDraftChange={handleDraftChange}
        />
        {previewVisible ? (
          <aside className="qf-quote-prep-preview">
            <h2 className="qf-card-heading">Preview</h2>
            <p className="qf-quote-prep-helper">
              Preview of what will become your official proposal.
            </p>
            <GeneratedProposalPreview proposal={previewProposal} />
          </aside>
        ) : null}
      </div>

      <div className="qf-quote-prep-sticky-actions">
        <form action={createAction} className="qf-quote-prep-create-form">
          <input type="hidden" name="enquiryId" value={enquiryId} />
          <input
            type="hidden"
            name="customerId"
            value={draft.customerId ?? ""}
          />
          <input
            type="hidden"
            name="visitId"
            value={draft.siteVisitSessionId ?? ""}
          />
          <input type="hidden" name="customerName" value={draft.customerName} />
          <input
            type="hidden"
            name="propertyAddress"
            value={draft.propertyAddress}
          />
          <input type="hidden" name="phoneNumber" value={draft.phoneNumber} />
          <input type="hidden" name="emailAddress" value={draft.emailAddress} />
          <input
            type="hidden"
            name="jobDescription"
            value={draft.jobDescription || draft.scopeSummary}
          />
          <input type="hidden" name="optionalExtras" value="" />
          <input type="hidden" name="estimatedPrice" value={draft.total} />
          <input
            type="hidden"
            name="estimatedDuration"
            value={draft.estimatedDuration}
          />
          <input
            type="hidden"
            name="plannedStartDateText"
            value={draft.plannedStartDateText}
          />
          <input
            type="hidden"
            name="plannedStartDateExact"
            value={draft.plannedStartDateExact}
          />
          <input
            type="hidden"
            name="bookingWindowKind"
            value={bookingWindow.kind}
          />
          <input
            type="hidden"
            name="bookingWindowMonth"
            value={bookingWindow.month ?? ""}
          />
          <input
            type="hidden"
            name="bookingWindowStart"
            value={bookingWindow.startDate ?? ""}
          />
          <input
            type="hidden"
            name="bookingWindowEnd"
            value={bookingWindow.endDate ?? ""}
          />
          <input
            type="hidden"
            name="generatedProposal"
            value={JSON.stringify(previewProposal)}
          />
          <CreateProposalSubmitButton disabled={!hasValidPrice} />
          <p className="qf-quote-prep-helper">{QUOTE_PREPARATION_CREATE_HINT}</p>
          {!hasValidPrice ? (
            <p className="qf-quote-prep-helper" role="status">
              Add a total price before creating the official proposal.
            </p>
          ) : null}
        </form>
        <button
          type="button"
          className="qf-btn-secondary qf-touch-target-comfortable"
          onClick={() => void handleSaveDraft()}
        >
          {QUOTE_PREPARATION_LOCAL_SAVE_BUTTON}
        </button>
        <button
          type="button"
          className="qf-btn-secondary qf-touch-target-comfortable"
          onClick={() => setShowPreview((current) => !current)}
        >
          {showPreview ? "Hide Preview" : "Preview Quote"}
        </button>
        <Link
          href={`/enquiries/${enquiryId}`}
          className="qf-btn-secondary qf-touch-target-comfortable"
        >
          Back to enquiry
        </Link>
      </div>
    </div>
  );
}
