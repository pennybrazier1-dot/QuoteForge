"use client";

import { useState } from "react";

export function QuoteComposer() {
  const [notes, setNotes] = useState("");
  const [showPlaceholder, setShowPlaceholder] = useState(false);

  const hasNotes = notes.trim().length > 0;

  function handleGenerate() {
    if (!hasNotes) return;
    setShowPlaceholder(true);
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-background-elevated p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
        What job are you quoting today?
      </h2>
      <p className="mt-2 text-sm text-muted">
        Jot down the rough details — the customer, the work, anything you priced
        on site. No need to make it tidy.
      </p>

      <label htmlFor="job-notes" className="sr-only">
        Rough job notes
      </label>
      <textarea
        id="job-notes"
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value);
          if (showPlaceholder) setShowPlaceholder(false);
        }}
        rows={6}
        placeholder="e.g. Mrs Whitfield, replace bathroom mixer tap and fit a thermostatic valve, about 3 hours labour…"
        className="mt-5 w-full resize-y rounded-xl border border-border-subtle bg-background px-4 py-3 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!hasNotes}
          className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-black transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Generate Proposal
        </button>
        <p className="text-xs text-muted">
          You stay in control — you can review and edit everything before it&apos;s
          sent.
        </p>
      </div>

      {showPlaceholder ? (
        <div
          role="status"
          className="mt-5 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent"
        >
          Proposal generation is coming soon. Your notes are ready to go the
          moment it&apos;s switched on.
        </div>
      ) : null}
    </div>
  );
}
