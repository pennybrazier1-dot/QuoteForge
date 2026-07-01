"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import {
  buildSendProposalMessage,
  buildSendProposalSubject,
  type SendProposalContext,
} from "@/lib/proposals/send-proposal-defaults";

type SendProposalDialogProps = {
  open: boolean;
  onClose: () => void;
  data: SendProposalContext;
};

function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="qf-send-section-title">{children}</h3>;
}

export function SendProposalDialog({
  open,
  onClose,
  data,
}: SendProposalDialogProps) {
  const titleId = useId();
  const customerName = data.customerName.trim() || "Customer";
  const [customerEmail, setCustomerEmail] = useState(data.customerEmail ?? "");
  const [subject, setSubject] = useState(() =>
    buildSendProposalSubject(customerName)
  );
  const [message, setMessage] = useState(() =>
    buildSendProposalMessage(customerName, data.businessName)
  );
  const [prepared, setPrepared] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCustomerEmail(data.customerEmail ?? "");
    setSubject(buildSendProposalSubject(customerName));
    setMessage(buildSendProposalMessage(customerName, data.businessName));
    setPrepared(false);
  }, [open, data, customerName]);

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

  if (!open) {
    return null;
  }

  const hasEmail = Boolean(customerEmail.trim());
  const editCustomerHref = data.customerId
    ? `/customers/${data.customerId}/edit`
    : "/customers";

  function handleSend() {
    setPrepared(true);
  }

  return (
    <div className="qf-send-root" role="presentation">
      <button
        type="button"
        className="qf-send-overlay"
        aria-label="Close send by email"
        onClick={onClose}
      />

      <div
        className="qf-send-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="qf-send-header">
          <div>
            <h2 id={titleId} className="qf-send-title">
              Send Proposal
            </h2>
            <p className="qf-send-subtitle">
              Review your email before sending it to your customer.
            </p>
          </div>
          <button
            type="button"
            className="qf-send-close"
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

        <div className="qf-send-body">
          {prepared ? (
            <section className="qf-send-prepared qf-card-inset" role="status">
              <h3 className="qf-send-prepared-title">
                Email sending isn&apos;t connected yet
              </h3>
              <p className="qf-send-prepared-lead">
                The email has been prepared successfully.
              </p>
              <p className="qf-send-prepared-copy">
                Connecting QuoteForge to your email service is the next
                development step.
              </p>
              <p className="qf-send-prepared-copy">
                Once connected, clicking &apos;Send by Email&apos; will:
              </p>
              <ul className="qf-send-prepared-list">
                <li>Generate the PDF</li>
                <li>Attach it automatically</li>
                <li>Send the email</li>
                <li>Update the proposal status to Sent</li>
                <li>Add the event to the proposal timeline</li>
              </ul>
            </section>
          ) : (
            <>
              <section className="qf-send-section qf-card-inset">
                <SectionHeading>Recipient</SectionHeading>
                <div className="qf-send-fields">
                  <div>
                    <label
                      htmlFor="send-customer-name"
                      className="qf-field-label"
                    >
                      Customer name
                    </label>
                    <input
                      id="send-customer-name"
                      type="text"
                      readOnly
                      value={customerName}
                      className="form-input mt-2"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="send-customer-email"
                      className="qf-field-label"
                    >
                      Customer email
                    </label>
                    <input
                      id="send-customer-email"
                      type="email"
                      value={customerEmail}
                      onChange={(event) =>
                        setCustomerEmail(event.target.value)
                      }
                      placeholder="customer@example.com"
                      className="form-input mt-2"
                    />
                  </div>
                </div>

                {!hasEmail ? (
                  <div className="qf-send-warning">
                    <p>
                      No email address has been saved for this customer.
                    </p>
                    <Link
                      href={editCustomerHref}
                      className="qf-send-warning-link"
                    >
                      Edit Customer
                    </Link>
                  </div>
                ) : null}
              </section>

              <section className="qf-send-section qf-card-inset">
                <SectionHeading>Subject</SectionHeading>
                <input
                  id="send-subject"
                  type="text"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="form-input"
                />
              </section>

              <section className="qf-send-section qf-card-inset">
                <SectionHeading>Email Message</SectionHeading>
                <textarea
                  id="send-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={12}
                  className="form-textarea qf-send-message"
                />
              </section>

              <section className="qf-send-section qf-card-inset">
                <SectionHeading>Attachments</SectionHeading>
                <ul className="qf-send-attachments">
                  <li className="qf-send-attachment qf-send-attachment-active">
                    <span
                      className="qf-send-attachment-check"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <p className="qf-send-attachment-title">Proposal.pdf</p>
                  </li>
                </ul>
                <p className="qf-send-attachments-helper">
                  Additional attachments such as photos and documents will be
                  available in a future update.
                </p>
              </section>
            </>
          )}
        </div>

        <footer className="qf-send-footer">
          {prepared ? (
            <button
              type="button"
              className="qf-btn-primary qf-send-footer-btn"
              onClick={onClose}
            >
              Close
            </button>
          ) : (
            <>
              <button
                type="button"
                className="qf-btn-secondary qf-send-footer-btn"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="qf-btn-primary qf-send-footer-btn"
                onClick={handleSend}
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
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
                Send by Email
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
