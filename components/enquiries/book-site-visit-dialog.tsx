"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  bookEnquirySiteVisit,
} from "@/lib/enquiries/enquiry-store";
import { formatEnquiryAddress } from "@/lib/enquiries/format";
import {
  buildSiteVisitConfirmationMessage,
  buildSiteVisitEmailSubject,
  buildSiteVisitOutreachMessage,
  SITE_VISIT_TIME_SLOTS,
} from "@/lib/enquiries/site-visit-messages";
import type { StoredEnquiry } from "@/lib/enquiries/types";
import { BOOK_SITE_VISIT_DIALOG_THEME } from "@/lib/enquiries/book-site-visit-dialog-theme";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

type BookSiteVisitDialogProps = {
  enquiry: StoredEnquiry;
  open: boolean;
  onClose: () => void;
  onBooked?: (message: string) => void;
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

export function BookSiteVisitDialog({
  enquiry,
  open,
  onClose,
  onBooked,
}: BookSiteVisitDialogProps) {
  const titleId = useId();
  const mounted = useClientMounted();
  const dialogSeed = open ? enquiry.id : null;
  const [appliedDialogSeed, setAppliedDialogSeed] = useState<string | null>(null);
  const [outreachMessage, setOutreachMessage] = useState(() =>
    buildSiteVisitOutreachMessage(enquiry.customerName)
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!open && appliedDialogSeed !== null) {
    setAppliedDialogSeed(null);
  }

  if (open && dialogSeed !== null && dialogSeed !== appliedDialogSeed) {
    setAppliedDialogSeed(dialogSeed);
    setOutreachMessage(buildSiteVisitOutreachMessage(enquiry.customerName));
    setSelectedSlotId(null);
    setNotice(null);
  }

  const selectedSlot =
    SITE_VISIT_TIME_SLOTS.find((slot) => slot.id === selectedSlotId) ?? null;

  const confirmationMessage = selectedSlot
    ? buildSiteVisitConfirmationMessage(
        enquiry.customerName,
        enquiry.tradespersonBusiness,
        selectedSlot.confirmationLine
      )
    : null;

  const activeMessage = confirmationMessage ?? outreachMessage;
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
    const copied = await copyText(activeMessage);
    setNotice(
      copied ? "Message copied to clipboard." : "Could not copy the message."
    );
  }

  function handleCall() {
    const phone = normalizePhoneForLink(enquiry.customerMobile);
    if (!phone) {
      setNotice("No phone number available for this customer.");
      return;
    }

    window.location.href = `tel:${phone}`;
  }

  function handleText() {
    const phone = normalizePhoneForLink(enquiry.customerMobile);
    if (!phone) {
      setNotice("No phone number available for this customer.");
      return;
    }

    window.location.href = `sms:${phone}?body=${encodeURIComponent(activeMessage)}`;
  }

  function handleEmail() {
    const email = enquiry.customerEmail.trim();
    if (!email) {
      setNotice("No email address available for this customer.");
      return;
    }

    const subject = buildSiteVisitEmailSubject(enquiry.tradespersonBusiness);
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(activeMessage)}`;
  }

  function handleMarkBooked() {
    if (!selectedSlot) {
      setNotice("Choose a time slot before marking the visit as booked.");
      return;
    }

    bookEnquirySiteVisit(enquiry.id, selectedSlot.label);
    onBooked?.(
      `Site visit marked as booked for ${selectedSlot.label} — saved locally for now.`
    );
    onClose();
  }

  return createPortal(
    <div className="qf-mgmt-dialog-root qf-mgmt-dialog-root-sheet" role="presentation">
      <button
        type="button"
        className="qf-mgmt-dialog-overlay"
        aria-label="Close book site visit dialog"
        onClick={onClose}
      />
      <div
        className={`qf-mgmt-dialog-panel qf-mgmt-dialog-panel-sheet ${BOOK_SITE_VISIT_DIALOG_THEME.panel}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="qf-mgmt-dialog-sheet-header">
          <div>
            <h2 id={titleId} className="qf-mgmt-dialog-title">
              Book site visit
            </h2>
            <p className="qf-mgmt-dialog-subtitle">
              Contact the customer and agree a time. Nothing is sent automatically yet.
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

        <div className={`qf-mgmt-dialog-sheet-body ${BOOK_SITE_VISIT_DIALOG_THEME.body}`}>
          <section className="qf-enquiry-site-visit-section">
            <h3 className="qf-enquiry-site-visit-section-title">Customer details</h3>
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
            <h3 className="qf-enquiry-site-visit-section-title">Suggested message</h3>
            <textarea
              className="qf-enquiry-site-visit-message"
              value={outreachMessage}
              onChange={(event) => setOutreachMessage(event.target.value)}
              rows={5}
            />
          </section>

          <section className="qf-enquiry-site-visit-section">
            <h3 className="qf-enquiry-site-visit-section-title">Contact customer</h3>
            <div className="qf-enquiry-site-visit-contact-actions">
              <button
                type="button"
                className="qf-btn-secondary qf-enquiry-site-visit-contact-btn"
                onClick={handleCall}
              >
                Call customer
              </button>
              <button
                type="button"
                className="qf-btn-secondary qf-enquiry-site-visit-contact-btn"
                onClick={handleText}
              >
                Text customer
              </button>
              <button
                type="button"
                className="qf-btn-secondary qf-enquiry-site-visit-contact-btn"
                onClick={handleEmail}
              >
                Email customer
              </button>
              <button
                type="button"
                className="qf-btn-secondary qf-enquiry-site-visit-contact-btn"
                onClick={handleCopyMessage}
              >
                Copy message
              </button>
            </div>
          </section>

          <section className="qf-enquiry-site-visit-section">
            <h3 className="qf-enquiry-site-visit-section-title">Suggested time slots</h3>
            <div className="qf-enquiry-site-visit-slots" role="listbox" aria-label="Suggested time slots">
              {SITE_VISIT_TIME_SLOTS.map((slot) => {
                const isSelected = slot.id === selectedSlotId;

                return (
                  <button
                    key={slot.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={[
                      "qf-enquiry-site-visit-slot",
                      isSelected ? "qf-enquiry-site-visit-slot-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedSlotId(slot.id)}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          </section>

          {confirmationMessage ? (
            <section className="qf-enquiry-site-visit-section">
              <h3 className="qf-enquiry-site-visit-section-title">
                Confirmation message preview
              </h3>
              <p className="qf-enquiry-site-visit-preview">{confirmationMessage}</p>
            </section>
          ) : null}

          <p className="qf-enquiry-site-visit-future-note">
            In future this will create a secure customer link where both sides can
            confirm appointment details and view updates.
          </p>

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
            Cancel
          </button>
          <button
            type="button"
            className="qf-mgmt-dialog-btn qf-mgmt-dialog-btn-primary"
            onClick={handleMarkBooked}
          >
            Mark as Site Visit Booked
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
