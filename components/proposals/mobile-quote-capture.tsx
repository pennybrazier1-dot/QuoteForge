"use client";

import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";

const SITE_NOTES_MAX = 4000;

const SITE_NOTES_HELPER =
  "Include customer name, address, phone, email, job details, measurements, materials, when the customer wants work to start, price, duration, optional extras, and anything to confirm — all in one place.";

export function MobileQuoteCapture({
  siteNotes,
  onSiteNotesChange,
  generateError,
  formAction,
}: {
  siteNotes: string;
  onSiteNotesChange: (value: string) => void;
  generateError?: string;
  formAction: (payload: FormData) => void;
}) {
  return (
    <div className="qf-mobile-quote-capture">
      <header className="qf-proposal-header">
        <h1 className="qf-proposal-title">New Quote</h1>
        <p className="qf-proposal-subtitle">
          Write everything you know. We&apos;ll organise it.
        </p>
      </header>

      <div className="qf-mobile-quote-capture-body">
        <label htmlFor="jobDescription" className="qf-field-label">
          Site Notes
        </label>
        <p className="qf-body-text mt-2 text-muted">{SITE_NOTES_HELPER}</p>
        <div className="qf-textarea-wrap mt-4">
          <textarea
            id="jobDescription"
            name="jobDescription"
            value={siteNotes}
            onChange={(event) =>
              onSiteNotesChange(
                event.target.value.slice(0, SITE_NOTES_MAX)
              )
            }
            rows={16}
            required
            maxLength={SITE_NOTES_MAX}
            placeholder="e.g. Mrs Sarah Whitfield, 14 Riverside Close Bristol. 07700 900123, sarah@example.com. Replace 12m fence, concrete posts, gravel boards. Tight access down side path. Quote around £850, about 2 days. Could add outside socket while on site — separate price."
            className="form-textarea qf-site-notes-textarea qf-mobile-site-notes"
          />
          <p className="qf-char-count" aria-live="polite">
            {siteNotes.length.toLocaleString()} /{" "}
            {SITE_NOTES_MAX.toLocaleString()}
          </p>
        </div>

        {generateError ? (
          <div className="mt-4">
            <AuthError message={generateError} />
          </div>
        ) : null}

        <GenerateQuoteButton formAction={formAction} />
      </div>
    </div>
  );
}

function GenerateQuoteButton({
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
      className="qf-btn-primary qf-mobile-quote-generate"
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
      {pending ? "Generating quote…" : "Generate Quote"}
    </button>
  );
}
