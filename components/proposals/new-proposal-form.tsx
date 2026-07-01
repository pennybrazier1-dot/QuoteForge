"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";
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
import { AcceptAiDraftButton } from "@/components/proposals/accept-ai-draft-button";
import { AuthError } from "@/components/auth/auth-shell";
import { GeneratedProposalPreview } from "@/components/proposals/generated-proposal-preview";
import { SectionCard } from "@/components/ui/section-card";
import type { ProposalFormValues } from "@/lib/proposals/form-values";

const saveInitialState: SaveDraftProposalState = {};
const generateInitialState: GenerateProposalState = {};
const acceptInitialState: AcceptAiDraftProposalState = {};

const SITE_NOTES_MAX = 4000;
const OPTIONAL_EXTRAS_MAX = 1000;

const SITE_NOTES_HELPER =
  "Write your site notes just as you would on paper. Include the work required, materials or products discussed, measurements, customer requests, access issues, estimated price or duration if you already know them, and anything that still needs confirming.";

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
    title: "Review and accept",
    description: "Check the AI draft and accept to save.",
  },
  {
    title: "Download or send",
    description: "Export as PDF or share with customer.",
  },
] as const;

const DURATION_UNITS = ["day", "days", "hour", "hours", "week", "weeks"] as const;

function splitDuration(duration: string) {
  const trimmed = duration.trim();

  if (!trimmed) {
    return { value: "", unit: "days" as const };
  }

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.+)$/i);

  if (match) {
    const unit = match[2]!.toLowerCase();

    if (DURATION_UNITS.includes(unit as (typeof DURATION_UNITS)[number])) {
      return {
        value: match[1]!,
        unit: unit as (typeof DURATION_UNITS)[number],
      };
    }
  }

  return { value: trimmed, unit: "days" as const };
}

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
  initialValues,
}: {
  mode?: "create" | "edit";
  proposalId?: string;
  initialValues?: ProposalFormValues;
}) {
  const saveAction = mode === "edit" ? updateDraftProposal : saveDraftProposal;
  const initialDuration = splitDuration(initialValues?.estimatedDuration ?? "");

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
  const [durationUnit, setDurationUnit] = useState(initialDuration.unit);

  const estimatedDuration = [durationValue.trim(), durationUnit]
    .filter(Boolean)
    .join(" ");

  const pageTitle = mode === "edit" ? "Edit Draft Proposal" : "New Proposal";
  const pageSubtitle =
    mode === "edit"
      ? "Update the customer details, site notes, or estimate. Your changes are saved when you tap Save Draft."
      : "Write your site notes and let AI create a professional proposal for you.";

  return (
    <form action={formAction} className="qf-proposal-page">
      {mode === "edit" && proposalId ? (
        <input type="hidden" name="proposalId" value={proposalId} />
      ) : null}

      {saveState.error ? (
        <div className="mb-6">
          <AuthError message={saveState.error} />
        </div>
      ) : null}

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

          {generateState.proposal ? (
            <div className="space-y-4">
              <GeneratedProposalPreview proposal={generateState.proposal} />
              <input
                type="hidden"
                name="generatedProposal"
                value={JSON.stringify(generateState.proposal)}
              />
              {acceptState.error ? (
                <AuthError message={acceptState.error} />
              ) : null}
              <AcceptAiDraftButton formAction={acceptAction} />
              <p className="text-center text-xs text-muted">
                Saves the AI draft as your official proposal. Your site notes stay
                as your original visit record.
              </p>
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
                        event.target.value as (typeof DURATION_UNITS)[number]
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
              <SaveDraftButton />
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
                Saves your site notes as a draft. AI draft is not saved until you
                accept it.
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
    </form>
  );
}

function GenerateButton({
  formAction,
}: {
  formAction: (payload: FormData) => void;
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
      {pending ? "Generating proposal…" : "Generate Proposal"}
    </button>
  );
}

function SaveDraftButton() {
  const { pending } = useFormStatus();

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
      {pending ? "Saving draft…" : "Save Draft"}
    </button>
  );
}
