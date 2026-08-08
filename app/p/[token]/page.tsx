import { CustomerProposalPortal } from "@/components/proposals/customer-portal/customer-proposal-portal";
import {
  loadPublicProposalByToken,
  recordPublicProposalViewed,
} from "@/lib/proposals/customer-portal/load-public-proposal";
import { loadProposalCustomerMessages } from "@/lib/proposals/customer-portal/messages";
import { createServiceRoleClient } from "@/lib/supabase/admin";

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

  let messages: Awaited<ReturnType<typeof loadProposalCustomerMessages>> = [];
  try {
    const supabase = createServiceRoleClient();
    messages = await loadProposalCustomerMessages(
      supabase,
      loaded.proposal.id
    );
  } catch {
    messages = [];
  }

  return <CustomerProposalPortal view={loaded.view} messages={messages} />;
}
