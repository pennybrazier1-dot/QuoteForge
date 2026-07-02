"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ProposalConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  destructive?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function ProposalConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel = "Working…",
  pending = false,
  destructive = false,
  error,
  onClose,
  onConfirm,
}: ProposalConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, pending]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="qf-mgmt-dialog-root" role="presentation">
      <button
        type="button"
        className="qf-mgmt-dialog-overlay"
        aria-label="Close dialog"
        onClick={pending ? undefined : onClose}
      />
      <div
        className="qf-mgmt-dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qf-mgmt-dialog-title"
      >
        <h2 id="qf-mgmt-dialog-title" className="qf-mgmt-dialog-title">
          {title}
        </h2>
        <div className="qf-mgmt-dialog-description">{description}</div>
        {error ? <p className="qf-mgmt-dialog-error">{error}</p> : null}
        <div className="qf-mgmt-dialog-actions">
          <button
            type="button"
            className="qf-mgmt-dialog-btn qf-mgmt-dialog-btn-secondary"
            onClick={onClose}
            disabled={pending}
          >
            Go back
          </button>
          <button
            type="button"
            className={`qf-mgmt-dialog-btn ${
              destructive
                ? "qf-mgmt-dialog-btn-danger"
                : "qf-mgmt-dialog-btn-primary"
            }`}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
