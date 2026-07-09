"use client";

import {
  buildCustomerJobViewModel,
  canRenderCustomerJobPage,
} from "@/lib/customer/customer-job-data";
import { useStoredEnquiry } from "@/lib/enquiries/use-stored-enquiries";
import { useClientMounted } from "@/lib/hooks/use-client-mounted";

function normalizePhoneForLink(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function CustomerJobView({ enquiryId }: { enquiryId: string }) {
  const mounted = useClientMounted();
  const enquiry = useStoredEnquiry(enquiryId);

  if (!mounted) {
    return (
      <div className="cj-page">
        <main className="cj-job-page">
          <p className="cj-job-loading">Loading your visit details…</p>
        </main>
      </div>
    );
  }

  if (!enquiry || !canRenderCustomerJobPage(enquiry)) {
    return (
      <div className="cj-page">
        <main className="cj-job-page">
          <section className="cj-job-card cj-job-card-empty">
            <h1 className="cj-job-title">Visit details unavailable</h1>
            <p className="cj-job-copy">
              This confirmation link is not available in this browser yet. Ask
              your tradesperson to resend the link once the visit is booked.
            </p>
          </section>
        </main>
      </div>
    );
  }

  const job = buildCustomerJobViewModel(enquiry);
  const phone = normalizePhoneForLink(job.tradespersonPhone);

  return (
    <div className="cj-page">
      <header className="cj-header">
        <div className="cj-header-brand">
          <div className="cj-logo">
            <span className="cj-logo-text">{job.businessName}</span>
          </div>
          <p className="cj-header-subtitle">Your site visit confirmation</p>
        </div>
      </header>

      <main className="cj-job-page">
        <section className="cj-job-card">
          <p className="cj-job-eyebrow">Site visit booked</p>
          <h1 className="cj-job-title">{job.visitDateTime}</h1>
          <p className="cj-job-copy">{job.visitPurpose}</p>
        </section>

        <section className="cj-job-card">
          <h2 className="cj-job-section-title">Property address</h2>
          <p className="cj-job-copy">{job.address}</p>
        </section>

        <section className="cj-job-card">
          <h2 className="cj-job-section-title">What the visit is for</h2>
          <p className="cj-job-copy">{job.projectDescription}</p>
        </section>

        <section className="cj-job-card cj-job-card-note">
          <h2 className="cj-job-section-title">Before we arrive</h2>
          <p className="cj-job-copy">{job.preparationNote}</p>
        </section>

        <section className="cj-job-card">
          <h2 className="cj-job-section-title">Contact {job.businessName}</h2>
          <div className="cj-job-contact-actions">
            <a
              className="cj-btn-secondary cj-job-contact-btn"
              href={phone ? `tel:${phone}` : undefined}
              aria-disabled={!phone}
            >
              Call
            </a>
            <a
              className="cj-btn-secondary cj-job-contact-btn"
              href={
                phone
                  ? `sms:${phone}?body=${encodeURIComponent("Hi, I have a question about my site visit.")}`
                  : undefined
              }
              aria-disabled={!phone}
            >
              Text
            </a>
            <a
              className="cj-btn-secondary cj-job-contact-btn"
              href={`mailto:${job.tradespersonEmail}?subject=${encodeURIComponent("Question about my site visit")}`}
            >
              Email
            </a>
          </div>
        </section>

        <section className="cj-job-card">
          <h2 className="cj-job-section-title">Status</h2>
          <ol className="cj-job-status-list">
            {job.statusSteps.map((step) => (
              <li
                key={step.id}
                className={[
                  "cj-job-status-item",
                  `cj-job-status-item-${step.state}`,
                ].join(" ")}
              >
                <span className="cj-job-status-marker" aria-hidden="true" />
                <span className="cj-job-status-label">{step.label}</span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
