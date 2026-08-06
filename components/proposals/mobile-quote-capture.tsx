"use client";

import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";

const SITE_NOTES_MAX = 4000;

const SITE_NOTES_HELPER =
  "Describe the job in your own words. Include materials, measurements, access notes, and customer requests — you can also note name, address, and contact details here when editing a draft.";

export function MobileQuoteCapture({
  siteNotes,
  onSiteNotesChange,
  generateError,
  formAction,
  title = "Quick Quote",
  subtitle = "Write the job details, then generate a proposal.",
}: {
  siteNotes: string;
  onSiteNotesChange: (value: string) => void;
  generateError?: string;
  formAction: (payload: FormData) => void;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="qf-mobile-quote-capture qf-mobile-safe">
      <header className="qf-proposal-header">
        <h1 className="qf-proposal-title">{title}</h1>
        <p className="qf-proposal-subtitle">{subtitle}</p>
      </header>

      <div className="qf-mobile-quote-capture-body">
        <label htmlFor="jobDescription" className="qf-field-label">
          Job description
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
            placeholder="Replace bathroom suite, move pipes, customer wants grey tiles, measurements…"
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
      className="qf-btn-primary qf-mobile-generate-btn mt-6"
    >
      {pending ? "Generating proposal…" : "Generate Proposal"}
    </button>
  );
}
