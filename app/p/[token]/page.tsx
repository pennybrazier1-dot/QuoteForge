import { CustomerProposalPortal } from "@/components/proposals/customer-portal/customer-proposal-portal";
import { isConversationDeepLink } from "@/lib/proposals/customer-portal/conversation-deep-link";
import {
  loadPublicProposalByToken,
  recordPublicProposalViewed,
} from "@/lib/proposals/customer-portal/load-public-proposal";
import { loadProposalCustomerMessages } from "@/lib/proposals/customer-portal/messages";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export default async function PublicProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const { token } = await params;
  const query = searchParams ? await searchParams : {};
  const loaded = await loadPublicProposalByToken(token);

  if (!loaded.ok) {
    return (
      <div className="cj-root cj-root--portal">
        <div className="cj-page">
          <main className="cj-portal-page">
            <header className="cj-portal-hero-wrap">
              <p className="cj-portal-brand-subtitle">Your proposal</p>
            </header>
            <section className="cj-portal-summary-card">
              <h1 className="cj-portal-summary-title">Proposal not found</h1>
              <p className="cj-portal-summary-copy">{loaded.error}</p>
            </section>
            <footer className="cj-portal-footer">
              <p>Powered by Reanvil</p>
              <p>Secure customer portal</p>
            </footer>
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

  return (
    <CustomerProposalPortal
      view={loaded.view}
      messages={messages}
      openConversation={isConversationDeepLink(query.view)}
    />
  );
}
