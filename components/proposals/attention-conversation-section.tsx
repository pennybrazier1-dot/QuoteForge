"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ProposalConversationPanel } from "@/components/proposals/proposal-conversation-panel";
import { SectionCard } from "@/components/ui/section-card";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";

const MOBILE_QUERY = "(max-width: 639px)";

function CardHeading({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="qf-card-heading-row">
      <span className="qf-card-heading-icon" aria-hidden="true">
        {icon}
      </span>
      <h2 className="qf-card-heading">{title}</h2>
    </div>
  );
}

/**
 * Attention-mode conversation: desktop keeps the full panel;
 * mobile collapses history and keeps reply lower on the page.
 */
export function AttentionConversationSection({
  proposalId,
  messages,
  headingIcon,
}: {
  proposalId: string;
  messages: ProposalCustomerMessage[];
  headingIcon: ReactNode;
}) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Avoid flashing the wrong layout before we know the viewport.
  if (isMobile === null) {
    return <div id="customer-replies" aria-hidden="true" />;
  }

  if (isMobile) {
    return (
      <div className="qf-attention-conversation-mobile">
        <details className="qf-attention-collapse">
          <summary className="qf-attention-collapse-summary">
            Conversation history
          </summary>
          <div className="qf-attention-collapse-body">
            <ProposalConversationPanel
              proposalId={proposalId}
              messages={messages}
              canReply={false}
              showComposer={false}
              showReviseLink={false}
            />
          </div>
        </details>

        <SectionCard className="qf-card-form qf-attention-reply-card">
          <CardHeading title="Reply to customer" icon={headingIcon} />
          <div className="mt-4">
            <ProposalConversationPanel
              proposalId={proposalId}
              messages={messages}
              canReply
              showThread={false}
              showReviseLink={false}
            />
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div id="customer-replies">
      <SectionCard className="qf-card-form">
        <CardHeading title="Conversation history" icon={headingIcon} />
        <div className="mt-4">
          <ProposalConversationPanel
            proposalId={proposalId}
            messages={messages}
            canReply
          />
        </div>
      </SectionCard>
    </div>
  );
}
