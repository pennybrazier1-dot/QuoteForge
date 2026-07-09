"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { CustomerJobLinkPanel } from "@/components/enquiries/customer-job-link-panel";
import {
  bookEnquirySiteVisit,
  recordEnquiryCustomerContact,
  recordSiteVisitRequested,
} from "@/lib/enquiries/enquiry-store";
import { formatEnquiryAddress } from "@/lib/enquiries/format";
import {
  buildSiteVisitConfirmationMessage,
  buildSiteVisitEmailSubject,
  buildSiteVisitOutreachMessage,
  resolveSiteVisitSlotDateTime,
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
  const [bookedEnquiry, setBookedEnquiry] = useState<StoredEnquiry | null>(null);

  if (!open && appliedDialogSeed !== null) {
    setAppliedDialogSeed(null);
    setBookedEnquiry(null);
  }

  if (open && dialogSeed !== null && dialogSeed !== appliedDialogSeed) {
    setAppliedDialogSeed(dialogSeed);
    setOutreachMessage(buildSiteVisitOutreachMessage(enquiry.customerName));
    setSelectedSlotId(null);
    setNotice(null);
    setBookedEnquiry(null);
  }

  const activeEnquiry = bookedEnquiry ?? enquiry;
  const isBooked = bookedEnquiry !== null;

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

    recordSiteVisitRequested(enquiry.id);

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
  }, [open, onClose, enquiry.id]);

  if (!open || !mounted) {
    return null;
  }

  async function handleCopyMessage() {
    const copied = await copyText(activeMessage);
    recordEnquiryCustomerContact(enquiry.id, "copy", "site_visit");
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

    recordEnquiryCustomerContact(enquiry.id, "call", "site_visit");
    window.location.href = `tel:${phone}`;
  }

  function handleText() {
    const phone = normalizePhoneForLink(enquiry.customerMobile);
    if (!phone) {
      setNotice("No phone number available for this customer.");
      return;
    }

    recordEnquiryCustomerContact(enquiry.id, "text", "site_visit");
    window.location.href = `sms:${phone}?body=${encodeURIComponent(activeMessage)}`;
  }

  function handleEmail() {
    const email = enquiry.customerEmail.trim();
    if (!email) {
      setNotice("No email address available for this customer.");
      return;
    }

    recordEnquiryCustomerContact(enquiry.id, "email", "site_visit");
    const subject = buildSiteVisitEmailSubject(enquiry.tradespersonBusiness);
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(activeMessage)}`;
  }

  function handleMarkBooked() {
    if (!selectedSlot) {
      setNotice("Choose a time slot before marking the visit as booked.");
      return;
    }

    const resolved = resolveSiteVisitSlotDateTime(selectedSlot.id);

    if (!resolved) {
      setNotice("Could not resolve the selected time slot.");
      return;
    }

    const updated = bookEnquirySiteVisit(enquiry.id, {
      slotId: selectedSlot.id,
      slotLabel: resolved.slotLabel,
      confirmationLine: resolved.confirmationLine,
      dateIso: resolved.dateIso,
      startsAt: resolved.startsAt,
    });

    if (!updated) {
      setNotice("Could not save the site visit booking.");
      return;
    }

    setBookedEnquiry(updated);
    onBooked?.(
      `Site visit marked as booked for ${resolved.slotLabel} — customer link ready to share.`
    );
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
                    disabled={isBooked}
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

          {isBooked ? (
            <CustomerJobLinkPanel
              enquiry={activeEnquiry}
              compact
              onNotice={setNotice}
            />
          ) : (
            <p className="qf-enquiry-site-visit-future-note">
              After booking, a customer confirmation link will be ready to copy
              and share.
            </p>
          )}

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
            {isBooked ? "Close" : "Cancel"}
          </button>
          {isBooked ? null : (
            <button
              type="button"
              className="qf-mgmt-dialog-btn qf-mgmt-dialog-btn-primary"
              onClick={handleMarkBooked}
            >
              Mark as Site Visit Booked
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}
