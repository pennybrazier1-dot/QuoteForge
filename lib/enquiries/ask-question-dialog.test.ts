import { describe, expect, it } from "vitest";
import { buildAskQuestionMessage } from "@/lib/enquiries/ask-question-messages";

describe("AskQuestionDialog integration", () => {
  it("opens with a customer message the trader can edit", () => {
    expect(buildAskQuestionMessage("Sarah Thompson")).toContain("Sarah");
    expect(buildAskQuestionMessage("Sarah Thompson")).toContain(
      "confirm a couple of details"
    );
  });
});
