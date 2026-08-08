import { describe, expect, it } from "vitest";
import {
  conversationAuthorLabel,
  sortConversationMessages,
} from "@/lib/proposals/customer-portal/conversation";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";

function msg(
  partial: Partial<ProposalCustomerMessage> &
    Pick<ProposalCustomerMessage, "id" | "kind" | "direction" | "created_at">
): ProposalCustomerMessage {
  return {
    body: "Hello",
    created_by: null,
    ...partial,
  };
}

describe("sortConversationMessages", () => {
  it("orders oldest first", () => {
    const ordered = sortConversationMessages([
      msg({
        id: "2",
        kind: "trader_reply",
        direction: "trader",
        created_at: "2026-08-08T12:00:00.000Z",
      }),
      msg({
        id: "1",
        kind: "question",
        direction: "customer",
        created_at: "2026-08-08T10:00:00.000Z",
      }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["1", "2"]);
  });
});

describe("conversationAuthorLabel", () => {
  it("labels trader replies for each viewer", () => {
    const reply = msg({
      id: "r",
      kind: "trader_reply",
      direction: "trader",
      created_at: "2026-08-08T12:00:00.000Z",
    });

    expect(conversationAuthorLabel(reply, "trader")).toBe("You");
    expect(conversationAuthorLabel(reply, "customer")).toBe("Trader");
  });

  it("labels customer change requests for each viewer", () => {
    const change = msg({
      id: "c",
      kind: "change_request",
      direction: "customer",
      created_at: "2026-08-08T11:00:00.000Z",
    });

    expect(conversationAuthorLabel(change, "customer")).toBe(
      "You (change request)"
    );
    expect(conversationAuthorLabel(change, "trader")).toBe(
      "Customer (change request)"
    );
  });
});
