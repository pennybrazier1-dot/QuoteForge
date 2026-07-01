"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionCard } from "@/components/ui/section-card";

export function StartProposalPanel() {
  const [notes, setNotes] = useState("");

  return (
    <SectionCard as="article">
      <h2 className="text-lg font-semibold">Start a new proposal</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Jot down the customer, the work, anything priced on site, and any details
        to confirm.
      </p>

      <label htmlFor="site-notes" className="sr-only">
        Site notes
      </label>
      <textarea
        id="site-notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={5}
        placeholder="e.g. Mrs Whitfield — mixer tap replacement, thermostatic valve, ~3 hours labour…"
        className="form-textarea mt-5"
      />

      <div className="mt-5">
        <Link
          href="/proposals/new"
          className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-8 text-sm font-semibold text-black transition-colors hover:bg-accent-hover"
        >
          Start New Proposal
        </Link>
        <p className="mt-2 text-xs text-muted">
          You stay in control — review and edit everything before it&apos;s sent.
        </p>
      </div>
    </SectionCard>
  );
}
