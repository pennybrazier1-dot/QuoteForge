import { describe, expect, it } from "vitest";
import {
  buildTraderReplyInsert,
  directionForMessageKind,
  isProposalMessageKind,
} from "@/lib/proposals/customer-portal/message-kinds";

describe("proposal message kinds", () => {
  it("supports trader replies as a kind", () => {
    expect(isProposalMessageKind("trader_reply")).toBe(true);
    expect(directionForMessageKind("trader_reply")).toBe("trader");
    expect(directionForMessageKind("change_request")).toBe("customer");
  });

  it("builds a trader reply insert with direction and author", () => {
    expect(
      buildTraderReplyInsert({
        workspaceId: "ws-1",
        proposalId: "prop-1",
        body: "  We can start Friday.  ",
        userId: "user-1",
      })
    ).toEqual({
      workspace_id: "ws-1",
      proposal_id: "prop-1",
      kind: "trader_reply",
      direction: "trader",
      body: "We can start Friday.",
      created_by: "user-1",
    });
  });
});
