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
      <div className="cj-page">
        <main className="cj-portal-page">
          <section className="cj-job-card">
            <h1 className="cj-job-title">Proposal not found</h1>
            <p className="cj-job-copy">{loaded.error}</p>
          </section>
        </main>
      </div>
    );
  }

  // Soft analytics — never blocks the page.
  void recordPublicProposalViewed(token);

  return <CustomerProposalPortal view={loaded.view} />;
}
