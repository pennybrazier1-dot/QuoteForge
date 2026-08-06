"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import { buildQuotePreparationDraftSafe } from "@/lib/proposals/quote-preparation/build-quote-draft";
import {
  getLocalProposalDraftByEnquiry,
  saveLocalProposalDraft,
} from "@/lib/proposals/quote-preparation/local-proposal-drafts";
import { mapQuoteDraftToGeneratedProposal } from "@/lib/proposals/quote-preparation/map-to-generated-proposal";
import {
  QUOTE_PREPARATION_LOCAL_SAVE_BUTTON,
  QUOTE_PREPARATION_LOCAL_SAVE_HINT,
  QUOTE_PREPARATION_LOCAL_SAVE_SUCCESS,
  type QuotePreparationDraft,
} from "@/lib/proposals/quote-preparation/types";
import type { SiteVisitSession } from "@/lib/site-visit/types";

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

  return (
    <div className="qf-quote-prep-page qf-mobile-safe">
      <header className="qf-proposal-header">
        <h1 className="qf-proposal-title">Prepare Quote</h1>
        <p className="qf-proposal-subtitle">
          Review the organised draft from the enquiry and site visit. Add your
          own prices when you are ready — nothing is sent until you use a real
          Reanvil proposal.
        </p>
        <p className="qf-quote-prep-local-hint">{QUOTE_PREPARATION_LOCAL_SAVE_HINT}</p>
      </header>

      {notice ? (
        <p className="qf-quote-prep-notice-banner" role="status">
          {notice}
        </p>
      ) : null}

      <div className="qf-quote-prep-layout">
        <QuotePreparationReview
          draft={draft}
          onDraftChange={handleDraftChange}
        />
        {isDesktop || showPreview ? (
          <aside className="qf-quote-prep-preview">
            <h2 className="qf-card-heading">Preview</h2>
            <p className="qf-quote-prep-helper">
              Preview only — this is not a saved Reanvil proposal yet.
            </p>
            <GeneratedProposalPreview proposal={previewProposal} />
          </aside>
        ) : null}
      </div>

      <div className="qf-quote-prep-sticky-actions">
        <button
          type="button"
          className="qf-btn-primary qf-touch-target-comfortable"
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
