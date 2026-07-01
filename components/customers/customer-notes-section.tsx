"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateCustomerNotes,
  type UpdateCustomerNotesState,
} from "@/app/customers/actions";
import { AuthError } from "@/components/auth/auth-shell";
import { SectionCard } from "@/components/ui/section-card";

const initialState: UpdateCustomerNotesState = {};

function SaveNotesButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-black transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save Notes"}
    </button>
  );
}

type CustomerNotesSectionProps = {
  customerId: string;
  notes: string | null;
};

export function CustomerNotesSection({
  customerId,
  notes,
}: CustomerNotesSectionProps) {
  const [editing, setEditing] = useState(false);
  const [draftNotes, setDraftNotes] = useState(notes ?? "");
  const [state, formAction] = useActionState(updateCustomerNotes, initialState);

  function handleCancel() {
    setDraftNotes(notes ?? "");
    setEditing(false);
  }

  return (
    <SectionCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Notes</h3>
          <p className="mt-1 text-sm text-muted">
            Private notes about this customer. Only your workspace can see them.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-9 items-center justify-center rounded-full border border-border-subtle bg-white/5 px-4 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
          >
            Edit Notes
          </button>
        ) : null}
      </div>

      {editing ? (
        <form action={formAction} className="mt-6">
          <input type="hidden" name="customerId" value={customerId} />

          <label htmlFor="customerNotes" className="block text-sm font-medium">
            Customer notes
          </label>
          <textarea
            id="customerNotes"
            name="notes"
            value={draftNotes}
            onChange={(event) => setDraftNotes(event.target.value)}
            rows={6}
            placeholder="e.g. Prefers morning visits. Has a dog in the back garden. Gate code 4521."
            className="form-textarea mt-2"
          />

          {state.error ? (
            <div className="mt-4">
              <AuthError message={state.error} />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <SaveNotesButton />
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex h-9 items-center justify-center rounded-full border border-border-subtle bg-white/5 px-4 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : notes ? (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {notes}
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">No notes yet.</p>
      )}
    </SectionCard>
  );
}
