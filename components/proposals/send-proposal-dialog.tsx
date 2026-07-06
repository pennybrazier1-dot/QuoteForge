"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  sendProposalByEmail,
  type SendProposalByEmailState,
} from "@/app/proposals/send-actions";
import { AuthError } from "@/components/auth/auth-shell";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";
import {
  buildSendProposalMessage,
  buildSendProposalSubject,
  type SendProposalContext,
} from "@/lib/proposals/send-proposal-defaults";

type SendProposalDialogProps = {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
  data: SendProposalContext;
};

const initialState: SendProposalByEmailState = {};

function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="qf-send-section-title">{children}</h3>;
}

export function SendProposalDialog({
  open,
  onClose,
  onSent,
  data,
}: SendProposalDialogProps) {
  const titleId = useId();
  const sendFormId = useId();
  const customerName = data.customerName.trim() || "Customer";
  const [customerEmail, setCustomerEmail] = useState(data.customerEmail ?? "");
  const [subject, setSubject] = useState(() =>
    buildSendProposalSubject(customerName)
  );
  const [message, setMessage] = useState(() =>
    buildSendProposalMessage(customerName, data.businessName)
  );
  const [state, formAction, isPending] = useActionState(
    sendProposalByEmail,
    initialState
  );
  const mounted = useClientMounted();

  const dialogFormSeed = open
    ? JSON.stringify({
        customerEmail: data.customerEmail ?? "",
        customerName,
        businessName: data.businessName,
      })
    : null;
  const [appliedDialogFormSeed, setAppliedDialogFormSeed] = useState<
    string | null
  >(null);

  if (!open && appliedDialogFormSeed !== null) {
    setAppliedDialogFormSeed(null);
  }

  if (open && dialogFormSeed !== null && dialogFormSeed !== appliedDialogFormSeed) {
    setAppliedDialogFormSeed(dialogFormSeed);
    setCustomerEmail(data.customerEmail ?? "");
    setSubject(buildSendProposalSubject(customerName));
    setMessage(buildSendProposalMessage(customerName, data.businessName));
  }

  useEffect(() => {
    if (state.success) {
      onSent();
    }
  }, [state.success, onSent]);

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

  const hasEmail = Boolean(customerEmail.trim());
  const editCustomerHref = data.customerId
    ? `/customers/${data.customerId}/edit`
    : "/customers";

  return createPortal(
    <div className="qf-send-root" role="presentation">
      <button
        type="button"
        className="qf-send-overlay"
        aria-label="Close send proposal"
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

        <form id={sendFormId} action={formAction} className="qf-send-form">
          <input type="hidden" name="proposalId" value={data.proposalId} />
          <input type="hidden" name="customerEmail" value={customerEmail} />
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="message" value={message} />

          <div className="qf-send-body">
            {state.error ? (
              <div className="qf-send-error">
                <AuthError message={state.error} />
              </div>
            ) : null}

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
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    placeholder="customer@example.com"
                    className="form-input mt-2"
                  />
                </div>
              </div>

              {!hasEmail ? (
                <div className="qf-send-warning">
                  <p>No email address has been saved for this customer.</p>
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
          </div>
        </form>

        <footer className="qf-send-footer">
          <button
            type="button"
            className="qf-btn-secondary qf-send-footer-btn qf-send-footer-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form={sendFormId}
            disabled={isPending}
            className="qf-btn-primary qf-send-footer-btn qf-send-footer-btn-primary"
          >
            {isPending ? "Sending…" : "Send"}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
