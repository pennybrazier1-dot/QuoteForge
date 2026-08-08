import { describe, expect, it } from "vitest";
import { buildRevisionSuggestions } from "@/lib/proposals/revision/build-revision-suggestions";
import type { ProposalCustomerMessage } from "@/lib/proposals/customer-portal/messages";
import {
  buildProposalRevisionReviewModel,
  buildRevisedProposalDraftFromDecisions,
} from "@/lib/proposals/revision/build-revision-review-model";

function msg(
  partial: Partial<ProposalCustomerMessage> &
    Pick<ProposalCustomerMessage, "id" | "kind" | "body">
): ProposalCustomerMessage {
  return {
    direction: "customer",
    created_by: null,
    created_at: "2026-08-08T10:00:00.000Z",
    ...partial,
  };
}

describe("buildRevisionSuggestions", () => {
  it("builds typed suggestions from a change request message", () => {
    const suggestions = buildRevisionSuggestions([
      msg({
        id: "m1",
        kind: "change_request",
        body: "Can we start on 12 October and use oak materials instead?",
      }),
    ]);

    const types = suggestions.map((item) => item.type);
    expect(types).toContain("start_date");
    expect(types).toContain("materials");

    const dateSuggestion = suggestions.find((item) => item.type === "start_date");
    expect(dateSuggestion?.evidenceQuote).toMatch(/12 October/i);
    expect(dateSuggestion?.needsReview).toBe(false);
    expect(dateSuggestion?.confidence).toBe("high");
  });

  it("marks price suggestions as needs review and ignores trader replies", () => {
    const suggestions = buildRevisionSuggestions([
      msg({
        id: "m1",
        kind: "question",
        body: "Is it possible to bring the price down from £2,500?",
      }),
      msg({
        id: "m2",
        kind: "trader_reply",
        direction: "trader",
        body: "I can review the price.",
      }),
    ]);

    expect(suggestions.every((item) => item.evidenceMessageId === "m1")).toBe(
      true
    );
    const price = suggestions.find((item) => item.type === "price");
    expect(price?.needsReview).toBe(true);
    expect(price?.suggestedChange).toMatch(/Do not change the price/i);
  });

  it("creates an extra work suggestion when additional scope is asked", () => {
    const suggestions = buildRevisionSuggestions([
      msg({
        id: "m1",
        kind: "change_request",
        body: "Can you also include tiling the hallway as extra work?",
      }),
    ]);

    expect(suggestions.map((item) => item.type)).toEqual(
      expect.arrayContaining(["scope", "extra_work"])
    );
  });
});

describe("buildProposalRevisionReviewModel", () => {
  it("builds a review-only model with an empty draft shell", () => {
    const model = buildProposalRevisionReviewModel(
      {
        id: "p1",
        proposal_number: "PROP-001",
        title: "Bathroom refit",
        customer_name: "Alex",
        total_amount: 250000,
        estimated_duration: "3 days",
        planned_start_date_text: "Next week",
        planned_start_date: null,
        job_summary: "Refit the family bathroom.",
        scope_of_work: "Remove suite\nFit new suite",
        materials: ["White suite"],
        labour_description: "Labour included",
        things_to_confirm_items: [],
        ai_optional_extras: [],
        payment_terms: "Due on completion",
      },
      [
        msg({
          id: "m1",
          kind: "change_request",
          body: "Please use oak materials.",
        }),
      ]
    );

    expect(model.summary.priceLabel).toContain("2,500");
    expect(model.summary.scopeOfWork.length).toBeGreaterThan(0);
    expect(model.suggestions.length).toBeGreaterThan(0);
    expect(model.draftShell.status).toBe("reviewing");
    expect(model.draftShell.fieldPatches).toEqual([]);
  });
});

describe("buildRevisedProposalDraftFromDecisions", () => {
  it("marks draft ready_to_preview when a suggestion is accepted", () => {
    const draft = buildRevisedProposalDraftFromDecisions({
      proposalId: "p1",
      sourceMessageIds: ["m1"],
      decisions: [{ suggestionId: "s1", decision: "accepted" }],
    });

    expect(draft.status).toBe("ready_to_preview");
    expect(draft.fieldPatches).toEqual([]);
  });
});
