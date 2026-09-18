import { describe, expect, it } from "vitest";
import {
  classifyConversationIntent,
  conversationHasDateChange,
  conversationHasProposalChange,
  conversationRequiresTraderAction,
  isOrdinaryConversation,
} from "@/lib/proposals/change-request/classify-conversation-intent";
import { buildConversationResolutionSummary } from "@/lib/proposals/change-request/build-conversation-resolution-summary";
import { shouldFlagAttentionForCustomerMessage } from "@/lib/proposals/customer-portal/conversation-access";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";

function msg(
  partial: Partial<ProposalCustomerMessage> &
    Pick<ProposalCustomerMessage, "id" | "kind" | "body" | "created_at">
): ProposalCustomerMessage {
  return {
    direction: partial.kind === "trader_reply" ? "trader" : "customer",
    created_by: null,
    ...partial,
  };
}

describe("classifyConversationIntent", () => {
  it("keeps ordinary conversation as conversation", () => {
    expect(
      classifyConversationIntent("Sorry, I'm running a little late, I'm stuck in traffic.")
    ).toBe("conversation");
    expect(classifyConversationIntent("No problem")).toBe("conversation");
    expect(classifyConversationIntent("See you soon")).toBe("conversation");
    expect(classifyConversationIntent("I'll see you soon")).toBe(
      "conversation"
    );
    expect(classifyConversationIntent("Thanks, that is fine.")).toBe(
      "conversation"
    );
    expect(classifyConversationIntent("How do I access the garden?")).toBe(
      "conversation"
    );
  });

  it("does not treat running late as a proposal revision", () => {
    expect(classifyConversationIntent("Running 20 minutes late")).toBe(
      "conversation"
    );
    expect(conversationRequiresTraderAction("Running 20 minutes late")).toBe(
      false
    );
    expect(isOrdinaryConversation("I'm running late today")).toBe(true);
  });

  it("does not treat late / time / today / tomorrow as a change request", () => {
    expect(classifyConversationIntent("See you today")).toBe("conversation");
    expect(classifyConversationIntent("See you tomorrow")).toBe("conversation");
    expect(classifyConversationIntent("What time should I be there?")).toBe(
      "conversation"
    );
  });

  it("detects a real scope change as Update proposal", () => {
    expect(classifyConversationIntent("Please add a towel rail.")).toBe(
      "proposal_change"
    );
    expect(
      classifyConversationIntent("May need door changed.")
    ).toBe("proposal_change");
    expect(
      classifyConversationIntent("Can we change the tiles?")
    ).toBe("proposal_change");
    expect(
      classifyConversationIntent("The price is too expensive for our budget.")
    ).toBe("proposal_change");
  });

  it("detects a real date-change request for the scheduling workflow", () => {
    expect(
      classifyConversationIntent("Can we move the job to Friday?")
    ).toBe("date_change");
    expect(
      classifyConversationIntent("Can we start next week instead of Monday?")
    ).toBe("date_change");
    expect(
      classifyConversationIntent(
        "I'd like a different date.\nRequested date: 2026-10-13"
      )
    ).toBe("date_change");
  });
});

describe("ordinary conversation does not become Update proposal", () => {
  it("does not show Update proposal for a booked-job chat", () => {
    const messages = [
      msg({
        id: "t1",
        kind: "trader_reply",
        body: "Sorry, I'm running a little late, I'm stuck in traffic.",
        created_at: "2026-09-18T08:00:00.000Z",
      }),
      msg({
        id: "c1",
        kind: "question",
        body: "No problem, see you soon.",
        created_at: "2026-09-18T08:02:00.000Z",
      }),
    ];

    expect(conversationHasProposalChange(messages)).toBe(false);
    expect(conversationHasDateChange(messages)).toBe(false);

    const summary = buildConversationResolutionSummary(messages, new Date(), {
      dateState: "confirmed",
      persistedDate: "2026-09-18",
      persistedTime: "09:00",
    });
    expect(summary.showUpdateProposal).toBe(false);
    expect(summary.hasActiveAttention).toBe(false);
  });

  it("does not create Needs Attention for a normal acknowledgement", () => {
    expect(
      shouldFlagAttentionForCustomerMessage(
        "waiting_for_customer",
        "No problem, see you soon."
      )
    ).toBe(false);
    expect(
      shouldFlagAttentionForCustomerMessage("booked", "Thanks, that is fine.")
    ).toBe(false);
    expect(
      shouldFlagAttentionForCustomerMessage(
        "waiting_for_customer",
        "Please add a second shower."
      )
    ).toBe(true);
  });

  it("keeps conversation available while hiding the stale action", () => {
    const messages = [
      msg({
        id: "c1",
        kind: "question",
        body: "See you soon",
        created_at: "2026-09-18T08:02:00.000Z",
      }),
    ];
    const summary = buildConversationResolutionSummary(messages);
    expect(summary.hasCustomerMessages).toBe(true);
    expect(summary.showUpdateProposal).toBe(false);
    expect(conversationHasProposalChange(messages)).toBe(false);
  });
});
