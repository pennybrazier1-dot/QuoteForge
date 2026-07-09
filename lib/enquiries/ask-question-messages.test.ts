import { describe, expect, it } from "vitest";
import {
  ASK_QUESTION_DIALOG_THEME,
  buildAskQuestionMessage,
} from "@/lib/enquiries/ask-question-messages";

describe("Ask Question dialog", () => {
  it("builds the suggested customer message", () => {
    expect(buildAskQuestionMessage("Sarah Thompson")).toBe(
      "Hi Sarah, thanks for your enquiry. I just need to confirm a couple of details before arranging the next step."
    );
  });

  it("uses the same dark-theme modal classes as site visit", () => {
    expect(ASK_QUESTION_DIALOG_THEME.panel).toBe("qf-enquiry-site-visit-panel");
    expect(ASK_QUESTION_DIALOG_THEME.message).toBe(
      "qf-enquiry-site-visit-message"
    );
  });
});
