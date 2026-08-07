import { CustomerProposalPortal } from "@/components/proposals/customer-portal/customer-proposal-portal";
import {
  loadPublicProposalByToken,
  recordPublicProposalViewed,
} from "@/lib/proposals/customer-portal/load-public-proposal";

export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const loaded = await loadPublicProposalByToken(token);

  if (!loaded.ok) {
    return (
      <div className="cj-root cj-root--portal">
        <div className="cj-page">
          <header className="cj-header cj-portal-header">
            <div className="cj-header-brand">
              <div className="cj-logo">
                <span className="cj-portal-brand-mark" aria-hidden="true">
                  R
                </span>
                <span className="cj-logo-text cj-portal-brand-name">Reanvil</span>
              </div>
              <p className="cj-header-subtitle">Your proposal</p>
            </div>
          </header>
          <main className="cj-portal-page">
            <section className="cj-job-card">
              <h1 className="cj-job-title">Proposal not found</h1>
              <p className="cj-job-copy">{loaded.error}</p>
            </section>
          </main>
        </div>
      </div>
    );
  }

  // Soft analytics — never blocks the page.
  void recordPublicProposalViewed(token);

  return <CustomerProposalPortal view={loaded.view} />;
}
