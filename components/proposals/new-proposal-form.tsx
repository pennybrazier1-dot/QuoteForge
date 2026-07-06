"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  acceptAiDraftProposal,
  saveDraftProposal,
  updateDraftProposal,
  type AcceptAiDraftProposalState,
  type SaveDraftProposalState,
} from "@/app/proposals/actions";
import {
  generateProposalDraft,
  type GenerateProposalState,
} from "@/app/proposals/generate-actions";
import { MarkReadyToSendButton } from "@/components/proposals/mark-ready-to-send-button";
import { AuthError } from "@/components/auth/auth-shell";
import { EditableProposalReview } from "@/components/proposals/editable-proposal-review";
import { GeneratedProposalPreview } from "@/components/proposals/generated-proposal-preview";
import { MobileQuoteCapture } from "@/components/proposals/mobile-quote-capture";
import { PlannedStartDateFields } from "@/components/proposals/planned-start-date-fields";
import { SectionCard } from "@/components/ui/section-card";
import type { GeneratedProposal } from "@/lib/ai";
import { logProposalFormMapping } from "@/lib/ai/proposal-debug";
import { logMobileOverflowElements } from "@/lib/dev/mobile-overflow-debug";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import type { ProposalFormValues } from "@/lib/proposals/form-values";
import {
  applyExtractedProposalFields,
  arrayToLines,
  DURATION_UNITS,
  splitDuration,
  type DurationUnit,
} from "@/lib/proposals/proposal-form-helpers";

const saveInitialState: SaveDraftProposalState = {};
const generateInitialState: GenerateProposalState = {};
const acceptInitialState: AcceptAiDraftProposalState = {};

const SITE_NOTES_MAX = 4000;
const OPTIONAL_EXTRAS_MAX = 1000;

const SITE_NOTES_HELPER =
  "Write your site notes just as you would on paper. Include the work required, materials or products discussed, measurements, customer requests, when the customer wants work to start, access issues, estimated price or duration if you already know them, and anything that still needs confirming.";

const OPTIONAL_EXTRAS_HELPER =
  "Add possible extra work you noticed on site that is not part of the main quote yet.";

const HOW_IT_WORKS_STEPS = [
  {
    title: "Write your site notes",
    description: "Add as much detail as you can.",
  },
  {
    title: "Generate proposal",
    description: "AI will create a professional proposal.",
  },
  {
    title: "Review and save",
    description: "Check the organised quote, then save as draft or mark ready to send.",
  },
  {
    title: "Download or send",
    description: "Export as PDF or share with customer.",
  },
] as const;

function CardHeading({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="qf-card-heading-row">
      <span className="qf-card-heading-icon" aria-hidden="true">
        {icon}
      </span>
      <h2 className="qf-card-heading">{title}</h2>
    </div>
  );
}

function FormField({
  label,
  id,
  name,
  type = "text",
  value,
  onChange,
  autoComplete,
  placeholder,
  required = false,
}: {
  label: string;
  id: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="qf-field-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        className="form-input mt-2"
      />
    </div>
  );
}

function CountedTextarea({
  id,
  name,
  value,
  onChange,
  rows,
  placeholder,
  helperText,
  maxLength,
  required = false,
  className = "",
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
  helperText?: string;
  maxLength: number;
  required?: boolean;
  className?: string;
}) {
  return (
    <div>
      {helperText ? (
        <p className="qf-body-text text-muted">{helperText}</p>
      ) : null}
      <div className={helperText ? "mt-4" : ""}>
        <div className="qf-textarea-wrap">
          <textarea
            id={id}
            name={name}
            value={value}
            onChange={(event) =>
              onChange(event.target.value.slice(0, maxLength))
            }
            rows={rows}
            placeholder={placeholder}
            required={required}
            maxLength={maxLength}
            className={`form-textarea ${className}`.trim()}
          />
          <p className="qf-char-count" aria-live="polite">
            {value.length.toLocaleString()} / {maxLength.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export function NewProposalForm({
  mode = "create",
  proposalId,
  proposalStatus,
  initialValues,
}: {
  mode?: "create" | "edit";
  proposalId?: string;
  proposalStatus?: string;
  initialValues?: ProposalFormValues;
}) {
  const saveAction = mode === "edit" ? updateDraftProposal : saveDraftProposal;
  const initialDuration = splitDuration(initialValues?.estimatedDuration ?? "");
  const isMobile = useMediaQuery("(max-width: 1023px)");

  const [saveState, formAction] = useActionState(
    saveAction,
    saveInitialState
  );
  const [generateState, generateAction] = useActionState(
    generateProposalDraft,
    generateInitialState
  );
  const [acceptState, acceptAction] = useActionState(
    acceptAiDraftProposal,
    acceptInitialState
  );

  const [reviewProposal, setReviewProposal] = useState<GeneratedProposal | null>(
    null
  );
  const [customerName, setCustomerName] = useState(
    initialValues?.customerName ?? ""
  );
  const [propertyAddress, setPropertyAddress] = useState(
    initialValues?.propertyAddress ?? ""
  );
  const [phoneNumber, setPhoneNumber] = useState(
    initialValues?.phoneNumber ?? ""
  );
  const [emailAddress, setEmailAddress] = useState(
    initialValues?.emailAddress ?? ""
  );
  const [jobDescription, setJobDescription] = useState(
    initialValues?.jobDescription ?? ""
  );
  const [optionalExtras, setOptionalExtras] = useState(
    initialValues?.optionalExtras ?? ""
  );
  const [estimatedPrice, setEstimatedPrice] = useState(
    initialValues?.estimatedPrice ?? ""
  );
  const [durationValue, setDurationValue] = useState(initialDuration.value);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(
    initialDuration.unit
  );
  const [plannedStartDateText, setPlannedStartDateText] = useState(
    initialValues?.plannedStartDateText ?? ""
  );
  const [plannedStartDateExact, setPlannedStartDateExact] = useState(
    initialValues?.plannedStartDateExact ?? ""
  );

  const [lastSyncedProposal, setLastSyncedProposal] = useState(
    generateState.proposal ?? null
  );

  if (
    generateState.proposal &&
    generateState.proposal !== lastSyncedProposal
  ) {
    const proposal = generateState.proposal;
    setLastSyncedProposal(proposal);
    setReviewProposal(proposal);

    const extracted = applyExtractedProposalFields(proposal);
    logProposalFormMapping(proposal, {
      estimatedPrice: extracted.estimatedPrice,
      optionalExtras: extracted.optionalExtras,
    });
    if (extracted.customerName) {
      setCustomerName(extracted.customerName);
    }
    if (extracted.propertyAddress) {
      setPropertyAddress(extracted.propertyAddress);
    }
    if (extracted.phoneNumber) {
      setPhoneNumber(extracted.phoneNumber);
    }
    if (extracted.emailAddress) {
      setEmailAddress(extracted.emailAddress);
    }
    if (extracted.estimatedPrice) {
      setEstimatedPrice(extracted.estimatedPrice);
    }
    if (extracted.durationValue) {
      setDurationValue(extracted.durationValue);
      setDurationUnit(extracted.durationUnit);
    }
    if (extracted.optionalExtras) {
      setOptionalExtras(extracted.optionalExtras);
    }
    if (proposal.plannedStartDate) {
      setPlannedStartDateText(proposal.plannedStartDate);
    }
    if (proposal.plannedStartDateExact) {
      setPlannedStartDateExact(proposal.plannedStartDateExact);
    }
  }

  const showMobileCapture = isMobile && !reviewProposal;
  const showMobileReview = isMobile && Boolean(reviewProposal);

  useEffect(() => {
    if (!showMobileCapture && !showMobileReview) {
      return;
    }

    const timer = window.setTimeout(() => {
      logMobileOverflowElements(
        showMobileCapture ? "new-quote-capture" : "new-quote-review"
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, [showMobileCapture, showMobileReview, reviewProposal]);

  const estimatedDuration =
    showMobileReview && reviewProposal
      ? reviewProposal.estimatedDuration.trim()
      : [durationValue.trim(), durationUnit].filter(Boolean).join(" ");

  const desktopProposal =
    reviewProposal ?? generateState.proposal ?? null;

  const proposalForSubmit = reviewProposal
    ? {
        ...reviewProposal,
        estimatedDuration,
        plannedStartDate: plannedStartDateText,
        plannedStartDateExact: plannedStartDateExact,
      }
    : generateState.proposal
      ? {
          ...generateState.proposal,
          estimatedDuration,
          plannedStartDate: plannedStartDateText,
          plannedStartDateExact: plannedStartDateExact,
        }
      : null;

  const pageTitle =
    mode === "edit"
      ? proposalStatus === "ready_to_send"
        ? "Edit Proposal"
        : "Edit Draft Proposal"
      : showMobileCapture || showMobileReview
        ? "New Quote"
        : "New Proposal";
  const pageSubtitle =
    mode === "edit"
      ? proposalStatus === "ready_to_send"
        ? "Update customer details, site notes, or your estimate before sending."
        : "Update the customer details, site notes, or estimate. Your changes are saved when you tap Save Draft."
      : showMobileCapture
        ? "Write everything you know. We'll organise it."
        : showMobileReview
          ? "Review and edit the organised quote before saving."
          : "Write your site notes and let AI create a professional proposal for you.";
  const saveLabel =
    mode === "edit" && proposalStatus === "ready_to_send"
      ? "Save Changes"
      : showMobileReview || desktopProposal
        ? "Save as Draft"
        : "Save Draft";

  return (
    <form action={formAction} className="qf-proposal-page qf-mobile-safe">
      {mode === "edit" && proposalId ? (
        <input type="hidden" name="proposalId" value={proposalId} />
      ) : null}

      {saveState.error ? (
        <div className="mb-6">
          <AuthError message={saveState.error} />
        </div>
      ) : null}

      {showMobileCapture ? (
        <>
          {mode === "create" ? (
            <>
              <input type="hidden" name="customerName" value="" />
              <input type="hidden" name="optionalExtras" value="" />
              <input type="hidden" name="estimatedPrice" value="" />
              <input type="hidden" name="estimatedDuration" value="" />
            </>
          ) : null}
          <MobileQuoteCapture
            siteNotes={jobDescription}
            onSiteNotesChange={setJobDescription}
            generateError={generateState.error}
            formAction={generateAction}
            title={mode === "edit" ? pageTitle : undefined}
            subtitle={mode === "edit" ? pageSubtitle : undefined}
          />
        </>
      ) : null}

      {showMobileReview && reviewProposal ? (
        <>
          <header className="qf-proposal-header">
            <h1 className="qf-proposal-title">{pageTitle}</h1>
            <p className="qf-proposal-subtitle">{pageSubtitle}</p>
          </header>

          <input type="hidden" name="jobDescription" value={jobDescription} />
          <input
            type="hidden"
            name="optionalExtras"
            value={arrayToLines(reviewProposal.optionalExtras)}
          />

          <EditableProposalReview
            proposal={reviewProposal}
            onProposalChange={setReviewProposal}
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            propertyAddress={propertyAddress}
            onPropertyAddressChange={setPropertyAddress}
            phoneNumber={phoneNumber}
            onPhoneNumberChange={setPhoneNumber}
            emailAddress={emailAddress}
            onEmailAddressChange={setEmailAddress}
            estimatedPrice={estimatedPrice}
            onEstimatedPriceChange={setEstimatedPrice}
            plannedStartDateText={plannedStartDateText}
            onPlannedStartDateTextChange={setPlannedStartDateText}
            plannedStartDateExact={plannedStartDateExact}
            onPlannedStartDateExactChange={setPlannedStartDateExact}
          />

          {proposalForSubmit ? (
            <div className="qf-proposal-review-actions mt-6">
              <input
                type="hidden"
                name="generatedProposal"
                value={JSON.stringify(proposalForSubmit)}
              />
              <input type="hidden" name="proposalStatusIntent" value="draft" />
              {saveState.error ? (
                <AuthError message={saveState.error} />
              ) : null}
              {acceptState.error ? (
                <AuthError message={acceptState.error} />
              ) : null}
              <SaveDraftButton label={saveLabel} />
              <MarkReadyToSendButton formAction={acceptAction} />
            </div>
          ) : null}

          <div className="mt-4">
            {generateState.error ? (
              <AuthError message={generateState.error} />
            ) : null}
            <GenerateButton
              formAction={generateAction}
              label="Regenerate Quote"
            />
          </div>
        </>
      ) : null}

      {!showMobileCapture && !showMobileReview ? (
        <>
          <header className="qf-proposal-header">
            <h1 className="qf-proposal-title">{pageTitle}</h1>
            <p className="qf-proposal-subtitle">{pageSubtitle}</p>
          </header>

          <div className="qf-proposal-layout">
            <div className="qf-proposal-col-left">
              <SectionCard className="qf-card-form">
                <CardHeading
                  title="Customer Information"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  }
                />
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <FormField
                    label="Customer Name"
                    id="customerName"
                    name="customerName"
                    value={customerName}
                    onChange={setCustomerName}
                    placeholder="e.g. Mrs Sarah Whitfield"
                    required
                  />
                  <FormField
                    label="Property Address"
                    id="propertyAddress"
                    name="propertyAddress"
                    value={propertyAddress}
                    onChange={setPropertyAddress}
                    placeholder="e.g. 14 Riverside Close, Bristol"
                  />
                  <FormField
                    label="Phone Number"
                    id="phoneNumber"
                    name="phoneNumber"
                    type="tel"
                    value={phoneNumber}
                    onChange={setPhoneNumber}
                    autoComplete="tel"
                    placeholder="e.g. 07700 900123"
                  />
                  <FormField
                    label="Email Address"
                    id="emailAddress"
                    name="emailAddress"
                    type="email"
                    value={emailAddress}
                    onChange={setEmailAddress}
                    autoComplete="email"
                    placeholder="e.g. sarah@example.com"
                  />
                </div>
              </SectionCard>

              <SectionCard className="qf-card-form">
                <CardHeading
                  title="Site Notes"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    </svg>
                  }
                />
                <div className="mt-5">
                  <CountedTextarea
                    id="jobDescription"
                    name="jobDescription"
                    value={jobDescription}
                    onChange={setJobDescription}
                    rows={14}
                    required
                    maxLength={SITE_NOTES_MAX}
                    helperText={SITE_NOTES_HELPER}
                    placeholder="e.g. Replace 12m fence, concrete posts, gravel boards. Customer wants same height. Tight access down side path. Quote around £850, about 2 days."
                    className="qf-site-notes-textarea"
                  />
                </div>
              </SectionCard>

              <SectionCard className="qf-card-form">
                <CardHeading
                  title="Optional Extras"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                  }
                />
                <div className="mt-5">
                  <CountedTextarea
                    id="optionalExtras"
                    name="optionalExtras"
                    value={optionalExtras}
                    onChange={setOptionalExtras}
                    rows={5}
                    maxLength={OPTIONAL_EXTRAS_MAX}
                    helperText={OPTIONAL_EXTRAS_HELPER}
                    placeholder="e.g. Outside socket while on site — separate price"
                  />
                </div>
              </SectionCard>

              {desktopProposal ? (
                <div className="space-y-4">
                  <GeneratedProposalPreview proposal={desktopProposal} />
                  <input
                    type="hidden"
                    name="generatedProposal"
                    value={JSON.stringify(
                      proposalForSubmit ??
                        (reviewProposal
                          ? {
                              ...reviewProposal,
                              estimatedDuration,
                              plannedStartDate: plannedStartDateText,
                              plannedStartDateExact: plannedStartDateExact,
                            }
                          : desktopProposal)
                    )}
                  />
                  <input type="hidden" name="proposalStatusIntent" value="draft" />
                  {saveState.error ? (
                    <AuthError message={saveState.error} />
                  ) : null}
                  {acceptState.error ? (
                    <AuthError message={acceptState.error} />
                  ) : null}
                  <SaveDraftButton label={saveLabel} />
                  <MarkReadyToSendButton formAction={acceptAction} />
                </div>
              ) : null}
            </div>

            <div className="qf-proposal-col-right">
              <SectionCard className="qf-card-form">
                <CardHeading
                  title="Estimate"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="16" height="20" x="4" y="2" rx="2" />
                      <path d="M8 6h8M8 10h8M8 14h4" />
                    </svg>
                  }
                />
                <p className="qf-body-text mt-2 text-muted">
                  If you already know the price or duration, enter it here. These
                  fields override anything mentioned in your site notes.
                </p>
                <div className="mt-5 space-y-5">
                  <div>
                    <label htmlFor="estimatedPrice" className="qf-field-label">
                      Estimated Price
                    </label>
                    <div className="qf-price-input mt-2">
                      <span className="qf-price-prefix" aria-hidden="true">
                        £
                      </span>
                      <input
                        id="estimatedPrice"
                        name="estimatedPrice"
                        type="text"
                        inputMode="decimal"
                        value={estimatedPrice}
                        onChange={(event) => setEstimatedPrice(event.target.value)}
                        placeholder="e.g. 850"
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="durationValue" className="qf-field-label">
                      Estimated Duration
                    </label>
                    <input
                      type="hidden"
                      name="estimatedDuration"
                      value={estimatedDuration}
                    />
                    <div className="qf-duration-input mt-2">
                      <input
                        id="durationValue"
                        type="text"
                        value={durationValue}
                        onChange={(event) => setDurationValue(event.target.value)}
                        placeholder="e.g. 1"
                        className="form-input"
                      />
                      <select
                        aria-label="Duration unit"
                        value={durationUnit}
                        onChange={(event) =>
                          setDurationUnit(
                            event.target.value as DurationUnit
                          )
                        }
                        className="form-select"
                      >
                        {DURATION_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit.charAt(0).toUpperCase() + unit.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <PlannedStartDateFields
                    textValue={plannedStartDateText}
                    exactValue={plannedStartDateExact}
                    onTextChange={(value) => {
                      setPlannedStartDateText(value);
                      if (reviewProposal) {
                        setReviewProposal({
                          ...reviewProposal,
                          plannedStartDate: value,
                        });
                      }
                    }}
                    onExactChange={(value) => {
                      setPlannedStartDateExact(value);
                      if (reviewProposal) {
                        setReviewProposal({
                          ...reviewProposal,
                          plannedStartDateExact: value,
                        });
                      }
                    }}
                  />
                </div>
              </SectionCard>

              <SectionCard className="qf-card-form">
                <CardHeading
                  title="Actions"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
                    </svg>
                  }
                />
                <div className="mt-5 space-y-3">
                  {generateState.error ? (
                    <AuthError message={generateState.error} />
                  ) : null}

                  <GenerateButton formAction={generateAction} />
                  {!desktopProposal ? (
                    <SaveDraftButton label={saveLabel} />
                  ) : null}
                  <p className="qf-actions-helper">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    {desktopProposal
                      ? "Use Save as Draft or Mark Ready to Send above after reviewing the quote."
                      : "Saves your site notes as a draft before you generate a quote."}
                  </p>
                </div>
              </SectionCard>

              <SectionCard className="qf-card-form">
                <div className="qf-card-heading-row">
                  <span
                    className="qf-card-heading-icon qf-card-heading-icon-info"
                    aria-hidden="true"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                  </span>
                  <h2 className="qf-card-heading">How QuoteForge Works</h2>
                </div>
                <ol className="qf-how-it-works mt-5">
                  {HOW_IT_WORKS_STEPS.map((step, index) => (
                    <li key={step.title} className="qf-how-it-works-step">
                      <span className="qf-how-it-works-number" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{step.title}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </SectionCard>
            </div>
          </div>
        </>
      ) : null}
    </form>
  );
}

function GenerateButton({
  formAction,
  label = "Generate Proposal",
}: {
  formAction: (payload: FormData) => void;
  label?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className="qf-btn-primary"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m12 3-1.9 5.8H4l4.9 3.6-1.9 5.8L12 14.6l5 3.8-1.9-5.8L20 8.8h-6.1L12 3z" />
      </svg>
      {pending ? "Generating proposal…" : label}
    </button>
  );
}

function SaveDraftButton({ label = "Save Draft" }: { label?: string }) {
  const { pending } = useFormStatus();
  const pendingLabel =
    label === "Save Changes" ? "Saving changes…" : "Saving draft…";

  return (
    <button
      type="submit"
      disabled={pending}
      className="qf-btn-secondary"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <path d="M21 3v6h-6" />
      </svg>
      {pending ? pendingLabel : label}
    </button>
  );
}
