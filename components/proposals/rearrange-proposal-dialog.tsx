"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import {
  rearrangeProposal,
  type ProposalManagementState,
} from "@/app/proposals/management-actions";
import { AuthError } from "@/components/auth/auth-shell";
import { PlannedStartDateFields } from "@/components/proposals/planned-start-date-fields";
import { plannedStartFromDb } from "@/lib/proposals/planned-start-date";

const initialState: ProposalManagementState = {};

function SaveScheduleButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="qf-mgmt-dialog-btn qf-mgmt-dialog-btn-primary"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

type RearrangeProposalDialogProps = {
  open: boolean;
  onClose: () => void;
  proposalId: string;
  plannedStartDateText: string | null;
  plannedStartDate: string | null;
  estimatedDuration: string | null;
};

export function RearrangeProposalDialog({
  open,
  onClose,
  proposalId,
  plannedStartDateText,
  plannedStartDate,
  estimatedDuration,
}: RearrangeProposalDialogProps) {
  const [state, formAction] = useActionState(rearrangeProposal, initialState);
  const [mounted, setMounted] = useState(false);
  const plannedStart = plannedStartFromDb({
    planned_start_date_text: plannedStartDateText,
    planned_start_date: plannedStartDate,
  });
  const [startText, setStartText] = useState(plannedStart.plannedStartDate);
  const [startExact, setStartExact] = useState(plannedStart.plannedStartDateExact);
  const [duration, setDuration] = useState(estimatedDuration ?? "");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const planned = plannedStartFromDb({
      planned_start_date_text: plannedStartDateText,
      planned_start_date: plannedStartDate,
    });

    setStartText(planned.plannedStartDate);
    setStartExact(planned.plannedStartDateExact);
    setDuration(estimatedDuration ?? "");
  }, [open, plannedStartDateText, plannedStartDate, estimatedDuration]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="qf-mgmt-dialog-root qf-mgmt-dialog-root-sheet" role="presentation">
      <button
        type="button"
        className="qf-mgmt-dialog-overlay"
        aria-label="Close rearrange dialog"
        onClick={onClose}
      />
      <div
        className="qf-mgmt-dialog-panel qf-mgmt-dialog-panel-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qf-rearrange-title"
      >
        <header className="qf-mgmt-dialog-sheet-header">
          <div>
            <h2 id="qf-rearrange-title" className="qf-mgmt-dialog-title">
              Rearrange
            </h2>
            <p className="qf-mgmt-dialog-subtitle">
              Update when this job is planned to start and how long it should
              take.
            </p>
          </div>
          <button
            type="button"
            className="qf-mgmt-dialog-close"
            aria-label="Close"
            onClick={onClose}
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
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form action={formAction} className="qf-mgmt-dialog-sheet-form">
          <input type="hidden" name="proposalId" value={proposalId} />

          <div className="qf-mgmt-dialog-sheet-body">
            {state.error ? <AuthError message={state.error} /> : null}

            <PlannedStartDateFields
              textValue={startText}
              exactValue={startExact}
              onTextChange={setStartText}
              onExactChange={setStartExact}
            />

            <div>
              <label htmlFor="rearrange-duration" className="qf-field-label">
                Estimated Duration
              </label>
              <input
                id="rearrange-duration"
                name="estimatedDuration"
                type="text"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                placeholder="e.g. 2–3 days"
                className="form-input mt-2"
              />
            </div>
          </div>

          <footer className="qf-mgmt-dialog-sheet-footer">
            <button
              type="button"
              className="qf-mgmt-dialog-btn qf-mgmt-dialog-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <SaveScheduleButton />
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}
