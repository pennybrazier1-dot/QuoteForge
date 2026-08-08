export const PROPOSAL_MESSAGE_KINDS = [
  "question",
  "change_request",
  "accept_note",
  "trader_reply",
] as const;

export type ProposalMessageKind = (typeof PROPOSAL_MESSAGE_KINDS)[number];

export const PROPOSAL_MESSAGE_DIRECTIONS = ["customer", "trader"] as const;

export type ProposalMessageDirection =
  (typeof PROPOSAL_MESSAGE_DIRECTIONS)[number];

export function isProposalMessageKind(
  value: string
): value is ProposalMessageKind {
  return (PROPOSAL_MESSAGE_KINDS as readonly string[]).includes(value);
}

export function isProposalMessageDirection(
  value: string
): value is ProposalMessageDirection {
  return (PROPOSAL_MESSAGE_DIRECTIONS as readonly string[]).includes(value);
}

export function directionForMessageKind(
  kind: ProposalMessageKind
): ProposalMessageDirection {
  return kind === "trader_reply" ? "trader" : "customer";
}

export type TraderReplyInsert = {
  workspace_id: string;
  proposal_id: string;
  kind: "trader_reply";
  direction: "trader";
  body: string;
  created_by: string;
};

export function buildTraderReplyInsert(input: {
  workspaceId: string;
  proposalId: string;
  body: string;
  userId: string;
}): TraderReplyInsert {
  return {
    workspace_id: input.workspaceId,
    proposal_id: input.proposalId,
    kind: "trader_reply",
    direction: "trader",
    body: input.body.trim(),
    created_by: input.userId,
  };
}
