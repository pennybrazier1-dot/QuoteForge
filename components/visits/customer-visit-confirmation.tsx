import type { PublicVisitConfirmationView } from "@/lib/visits/customer-confirmation/public-view";

export function CustomerVisitConfirmation({
  view,
}: {
  view: PublicVisitConfirmationView;
}) {
  return (
    <div className="cj-page">
      <header className="cj-header">
        <div className="cj-header-brand">
          <div className="cj-logo">
            <span className="cj-logo-text">{view.businessName}</span>
          </div>
          <p className="cj-header-subtitle">Your site visit confirmation</p>
        </div>
      </header>

      <main className="cj-job-page">
        <section className="cj-job-card">
          <p className="cj-job-eyebrow">
            {view.isCancelled ? "Visit cancelled" : "Site visit booked"}
          </p>
          <h1 className="cj-job-title">{view.visitDateTime}</h1>
          <p className="cj-job-copy">{view.visitPurpose}</p>
          <p className="cj-job-copy">
            Status: <strong>{view.statusLabel}</strong>
          </p>
        </section>

        {view.address ? (
          <section className="cj-job-card">
            <h2 className="cj-job-section-title">Property address</h2>
            <p className="cj-job-copy">{view.address}</p>
          </section>
        ) : null}

        {view.projectSummary ? (
          <section className="cj-job-card">
            <h2 className="cj-job-section-title">What the visit is for</h2>
            <p className="cj-job-copy">{view.projectSummary}</p>
          </section>
        ) : null}

        {view.isCancelled ? (
          <section className="cj-job-card cj-job-card-note">
            <h2 className="cj-job-section-title">This visit is no longer going ahead</h2>
            <p className="cj-job-copy">
              Please contact {view.businessName} if you need to arrange a new
              time.
            </p>
          </section>
        ) : (
          <section className="cj-job-card cj-job-card-note">
            <h2 className="cj-job-section-title">Before we arrive</h2>
            <p className="cj-job-copy">
              Please make sure the work area is accessible before we arrive.
            </p>
          </section>
        )}

        <footer className="cj-portal-footer">
          <p>Powered by Reanvil</p>
          <p>Secure visit confirmation</p>
        </footer>
      </main>
    </div>
  );
}

export function CustomerVisitConfirmationMissing({
  message,
}: {
  message: string;
}) {
  return (
    <div className="cj-page">
      <main className="cj-job-page">
        <section className="cj-job-card cj-job-card-empty">
          <h1 className="cj-job-title">Visit details unavailable</h1>
          <p className="cj-job-copy">{message}</p>
        </section>
        <footer className="cj-portal-footer">
          <p>Powered by Reanvil</p>
          <p>Secure visit confirmation</p>
        </footer>
      </main>
    </div>
  );
}
