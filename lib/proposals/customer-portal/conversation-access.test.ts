import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isConversationReplyable,
  shouldFlagAttentionForCustomerMessage,
} from "@/lib/proposals/customer-portal/conversation-access";
import {
  appendConversationDeepLink,
  isConversationDeepLink,
} from "@/lib/proposals/customer-portal/conversation-deep-link";
import {
  buildCustomerConversationUrl,
  buildTraderConversationUrl,
} from "@/lib/proposals/customer-portal/conversation-notify";
import { createCustomerAccessToken } from "@/lib/proposals/customer-portal/token";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("conversation access across the job lifecycle", () => {
  it("keeps waiting-for-customer conversation replyable", () => {
    expect(isConversationReplyable("waiting_for_customer")).toBe(true);
  });

  it("keeps needs-attention conversation replyable", () => {
    expect(isConversationReplyable("needs_attention")).toBe(true);
  });

  it("keeps booked and scheduled/in-progress jobs replyable", () => {
    expect(isConversationReplyable("booked")).toBe(true);
    expect(isConversationReplyable("in_progress")).toBe(true);
  });

  it("does not lock conversation after accept or date confirmation", () => {
    expect(isConversationReplyable("booked")).toBe(true);
    expect(shouldFlagAttentionForCustomerMessage("booked")).toBe(false);
    expect(shouldFlagAttentionForCustomerMessage("waiting_for_customer")).toBe(
      true
    );
    expect(
      shouldFlagAttentionForCustomerMessage(
        "waiting_for_customer",
        "No problem, see you soon."
      )
    ).toBe(false);
    expect(
      shouldFlagAttentionForCustomerMessage(
        "waiting_for_customer",
        "Please add a second shower."
      )
    ).toBe(true);
  });

  it("keeps completed and invoice-stage conversation replyable", () => {
    expect(isConversationReplyable("completed")).toBe(true);
    expect(isConversationReplyable("invoiced")).toBe(true);
    expect(isConversationReplyable("paid")).toBe(true);
  });

  it("locks conversation only when the proposal is genuinely closed", () => {
    expect(isConversationReplyable("cancelled")).toBe(false);
    expect(isConversationReplyable("declined")).toBe(false);
    expect(isConversationReplyable("closed")).toBe(false);
  });
});

describe("message email deep links", () => {
  it("deep-links trader→customer emails to conversation without a new token", () => {
    const token = "CEcHRg2ZMCSLkHZS5SqQ3dst";
    const url = buildCustomerConversationUrl(token);
    expect(url).toContain(`/p/${token}`);
    expect(url).toContain("view=conversation");
    expect(url).toContain("#proposal-conversation");
    expect(appendConversationDeepLink(`/p/${token}`)).toBe(
      `/p/${token}?view=conversation#proposal-conversation`
    );
    expect(readRepo("lib/email/transactional-events.ts")).not.toContain(
      "createCustomerAccessToken"
    );
    expect(createCustomerAccessToken()).toHaveLength(32);
  });

  it("deep-links customer→trader emails to the workspace conversation", () => {
    const url = buildTraderConversationUrl("proposal-1");
    expect(url).toContain("/proposals/proposal-1");
    expect(url).toContain("view=conversation");
    expect(url).toContain("#proposal-conversation");
    expect(isConversationDeepLink("conversation")).toBe(true);
    expect(isConversationDeepLink("")).toBe(false);
  });
});

describe("portal conversation deep-link behaviour", () => {
  it("auto-expands conversation only for the message deep-link", () => {
    const portalPage = readRepo("app/p/[token]/page.tsx");
    const conversation = readRepo(
      "components/proposals/customer-portal/customer-portal-conversation.tsx"
    );
    const layout = readRepo(
      "lib/proposals/customer-portal/portal-page-layout.ts"
    );
    expect(portalPage).toContain("isConversationDeepLink");
    expect(portalPage).toContain("openConversation");
    expect(conversation).toContain("defaultOpen={openConversation}");
    expect(conversation).toContain("CONVERSATION_LATEST_ID");
    expect(layout).toContain("return false");
    expect(layout).toContain("portalConversationDefaultOpen");
  });

  it("lets the customer reply through the existing portal token", () => {
    const actions = readRepo("lib/proposals/customer-portal/actions.ts");
    const conversation = readRepo(
      "components/proposals/customer-portal/customer-portal-conversation.tsx"
    );
    expect(readRepo("components/proposals/proposal-conversation-panel.tsx")).toContain(
      "conversationHasProposalChange"
    );
    expect(readRepo("components/proposals/proposal-conversation-panel.tsx")).toContain(
      "showReviseLink = false"
    );
    expect(conversation).toContain("askPublicProposalQuestion");
    expect(conversation).toContain('name="token"');
    expect(actions).toContain("canMessage");
    expect(actions).toContain("buildTraderMessageNotification");
    expect(actions).toContain("shouldFlagAttentionForCustomerMessage");
    expect(actions).not.toContain("createCustomerAccessToken");
  });

  it("does not change booking or acceptance rules", () => {
    const actions = readRepo("lib/proposals/customer-portal/actions.ts");
    expect(actions).toContain("canShowFinalAccept");
    expect(actions).toContain("acceptPublicProposal");
    expect(actions).toContain("ensureJobForAcceptedProposal");
    expect(readRepo("lib/proposals/acceptance-rules.ts")).toContain(
      "canShowFinalAccept"
    );
  });
});
