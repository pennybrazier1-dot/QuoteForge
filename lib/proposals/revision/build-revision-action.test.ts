import { describe, expect, it } from "vitest";
import {
  actionTypeForSuggestionType,
  buildRevisionActionHref,
  createRevisionActionFromSuggestion,
  formatRevisionActionType,
  withRevisionActionStatus,
} from "@/lib/proposals/revision/build-revision-action";
import type { RevisionSuggestion } from "@/lib/proposals/revision/types";

function suggestion(
  partial: Partial<RevisionSuggestion> &
    Pick<RevisionSuggestion, "id" | "type" | "suggestedChange">
): RevisionSuggestion {
  return {
    evidenceQuote: "Can we start 12 October with grey tiles?",
    evidenceMessageId: "m1",
    confidence: "medium",
    needsReview: false,
    targetField: null,
    ...partial,
  };
}

describe("createRevisionActionFromSuggestion", () => {
  it("creates a pending open_calendar action for start_date suggestions", () => {
    const action = createRevisionActionFromSuggestion({
      proposalId: "p1",
      suggestion: suggestion({
        id: "s-date",
        type: "start_date",
        suggestedChange: 'Consider updating the planned start to “12 October”.',
        evidenceQuote: "Can we start 12 October?",
      }),
      acceptedSuggestedChange:
        'Consider updating the planned start to “12 October”.',
      now: new Date("2026-08-08T12:00:00.000Z"),
    });

    expect(action.proposalId).toBe("p1");
    expect(action.suggestionId).toBe("s-date");
    expect(action.actionType).toBe("open_calendar");
    expect(action.status).toBe("pending");
    expect(action.payload.plannedStartText).toMatch(/12 October/i);
    expect(formatRevisionActionType(action.actionType)).toBe("Open calendar");
  });

  it("maps materials and scope to the expected next actions", () => {
    expect(actionTypeForSuggestionType("materials")).toBe("update_materials");
    expect(actionTypeForSuggestionType("scope")).toBe(
      "review_scope_and_price"
    );
    expect(formatRevisionActionType("update_materials")).toBe(
      "Update materials"
    );
    expect(formatRevisionActionType("review_scope_and_price")).toBe(
      "Review scope & price"
    );
  });

  it("builds navigation hrefs without implying a data write", () => {
    const calendar = createRevisionActionFromSuggestion({
      proposalId: "p1",
      suggestion: suggestion({
        id: "s1",
        type: "start_date",
        suggestedChange: "Start 12 October",
        evidenceQuote: "12 October please",
      }),
      acceptedSuggestedChange: "Start 12 October",
    });
    const materials = createRevisionActionFromSuggestion({
      proposalId: "p1",
      suggestion: suggestion({
        id: "s2",
        type: "materials",
        suggestedChange: "Add grey tiles",
        evidenceQuote: "Please use grey tiles",
      }),
      acceptedSuggestedChange: "Add grey tiles",
    });
    const scope = createRevisionActionFromSuggestion({
      proposalId: "p1",
      suggestion: suggestion({
        id: "s3",
        type: "scope",
        suggestedChange: "Add garden wall",
        evidenceQuote: "Please add a garden wall",
      }),
      acceptedSuggestedChange: "Add garden wall",
    });

    expect(buildRevisionActionHref(calendar)).toContain("confirmBooking=1");
    expect(buildRevisionActionHref(calendar)).toContain("plannedStartHint=");
    expect(buildRevisionActionHref(materials)).toContain("#job-preparation");
    expect(buildRevisionActionHref(scope)).toContain(
      "#change-request-review-target"
    );
  });

  it("can mark actions opened or skipped without other side effects", () => {
    const action = createRevisionActionFromSuggestion({
      proposalId: "p1",
      suggestion: suggestion({
        id: "s1",
        type: "materials",
        suggestedChange: "Add grey tiles",
      }),
      acceptedSuggestedChange: "Add grey tiles",
    });

    expect(withRevisionActionStatus(action, "opened").status).toBe("opened");
    expect(withRevisionActionStatus(action, "skipped").status).toBe("skipped");
    expect(action.status).toBe("pending");
  });
});
