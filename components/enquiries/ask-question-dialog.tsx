"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  ASK_QUESTION_DIALOG_THEME,
  buildAskQuestionEmailSubject,
  buildAskQuestionMessage,
} from "@/lib/enquiries/ask-question-messages";
import { recordEnquiryCustomerContact } from "@/lib/enquiries/enquiry-store";
import { formatEnquiryAddress } from "@/lib/enquiries/format";
import type { StoredEnquiry } from "@/lib/enquiries/types";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

type AskQuestionDialogProps = {
  enquiry: StoredEnquiry;
  open: boolean;
  onClose: () => void;
  onAction?: (message: string) => void;
};

function normalizePhoneForLink(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function AskQuestionDialog({
  enquiry,
  open,
  onClose,
  onAction,
}: AskQuestionDialogProps) {
  const titleId = useId();
  const mounted = useClientMounted();
  const dialogSeed = open ? enquiry.id : null;
  const [appliedDialogSeed, setAppliedDialogSeed] = useState<string | null>(null);
  const [message, setMessage] = useState(() =>
    buildAskQuestionMessage(enquiry.customerName)
  );
  const [notice, setNotice] = useState<string | null>(null);

  if (!open && appliedDialogSeed !== null) {
    setAppliedDialogSeed(null);
  }

  if (open && dialogSeed !== null && dialogSeed !== appliedDialogSeed) {
    setAppliedDialogSeed(dialogSeed);
    setMessage(buildAskQuestionMessage(enquiry.customerName));
    setNotice(null);
  }

  const address = formatEnquiryAddress(enquiry);

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

  async function handleCopyMessage() {
    const copied = await copyText(message);
    recordEnquiryCustomerContact(enquiry.id, "copy", "question");
    setNotice(
      copied ? "Message copied to clipboard." : "Could not copy the message."
    );
    onAction?.(
      copied ? "Customer message copied — saved locally for now." : "Could not copy the message."
    );
  }

  function handleText() {
    const phone = normalizePhoneForLink(enquiry.customerMobile);
    if (!phone) {
      setNotice("No phone number available for this customer.");
      return;
    }

    recordEnquiryCustomerContact(enquiry.id, "text", "question");
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
    onAction?.("Customer text message prepared — saved locally for now.");
  }

  function handleEmail() {
    const email = enquiry.customerEmail.trim();
    if (!email) {
      setNotice("No email address available for this customer.");
      return;
    }

    recordEnquiryCustomerContact(enquiry.id, "email", "question");
    const subject = buildAskQuestionEmailSubject(enquiry.tradespersonBusiness);
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    onAction?.("Customer email prepared — saved locally for now.");
  }

  return createPortal(
    <div className="qf-mgmt-dialog-root qf-mgmt-dialog-root-sheet" role="presentation">
      <button
        type="button"
        className="qf-mgmt-dialog-overlay"
        aria-label="Close ask question dialog"
        onClick={onClose}
      />
      <div
        className={`qf-mgmt-dialog-panel qf-mgmt-dialog-panel-sheet ${ASK_QUESTION_DIALOG_THEME.panel}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="qf-mgmt-dialog-sheet-header">
          <div>
            <h2 id={titleId} className="qf-mgmt-dialog-title">
              Ask a question
            </h2>
            <p className="qf-mgmt-dialog-subtitle">
              Contact the customer with a quick question. Nothing is sent automatically yet.
            </p>
          </div>
          <button
            type="button"
            className="qf-mgmt-dialog-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={`qf-mgmt-dialog-sheet-body ${ASK_QUESTION_DIALOG_THEME.body}`}>
          <section className="qf-enquiry-site-visit-section">
            <h3 className={ASK_QUESTION_DIALOG_THEME.sectionTitle}>Customer details</h3>
            <dl className="qf-enquiry-detail-list">
              <div>
                <dt>Name</dt>
                <dd>{enquiry.customerName}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{enquiry.customerMobile || "Not provided"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{enquiry.customerEmail || "Not provided"}</dd>
              </div>
              <div>
                <dt>Job address</dt>
                <dd>{address || "Not provided"}</dd>
              </div>
            </dl>
          </section>

          <section className="qf-enquiry-site-visit-section">
            <h3 className={ASK_QUESTION_DIALOG_THEME.sectionTitle}>Suggested message</h3>
            <textarea
              className={ASK_QUESTION_DIALOG_THEME.message}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
            />
          </section>

          <section className="qf-enquiry-site-visit-section">
            <h3 className={ASK_QUESTION_DIALOG_THEME.sectionTitle}>Contact customer</h3>
            <div className="qf-enquiry-site-visit-contact-actions">
              <button
                type="button"
                className={`qf-btn-secondary ${ASK_QUESTION_DIALOG_THEME.contactButton}`}
                onClick={handleText}
              >
                Text customer
              </button>
              <button
                type="button"
                className={`qf-btn-secondary ${ASK_QUESTION_DIALOG_THEME.contactButton}`}
                onClick={handleEmail}
              >
                Email customer
              </button>
              <button
                type="button"
                className={`qf-btn-secondary ${ASK_QUESTION_DIALOG_THEME.contactButton}`}
                onClick={() => void handleCopyMessage()}
              >
                Copy message
              </button>
            </div>
          </section>

          {notice ? (
            <p className="qf-enquiry-card-notice" role="status">
              {notice}
            </p>
          ) : null}
        </div>

        <footer className="qf-mgmt-dialog-sheet-footer qf-enquiry-site-visit-footer">
          <button
            type="button"
            className="qf-mgmt-dialog-btn qf-mgmt-dialog-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
