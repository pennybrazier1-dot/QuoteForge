import { describe, expect, it } from "vitest";
import {
  QUOTE_PREPARATION_LOCAL_SAVE_BUTTON,
  QUOTE_PREPARATION_LOCAL_SAVE_HINT,
  QUOTE_PREPARATION_LOCAL_SAVE_SUCCESS,
  QUOTE_PREPARATION_VAT_HELPER,
} from "@/lib/proposals/quote-preparation/types";

describe("quote preparation local-only messaging", () => {
  it("uses calm copy that does not claim online or sent status", () => {
    expect(QUOTE_PREPARATION_LOCAL_SAVE_BUTTON).toBe("Save local draft");
    expect(QUOTE_PREPARATION_LOCAL_SAVE_HINT.toLowerCase()).toContain(
      "this device"
    );
    expect(QUOTE_PREPARATION_LOCAL_SAVE_HINT.toLowerCase()).not.toContain(
      "backed up"
    );
    expect(QUOTE_PREPARATION_LOCAL_SAVE_SUCCESS.toLowerCase()).toContain(
      "not online"
    );
    expect(QUOTE_PREPARATION_VAT_HELPER.toLowerCase()).toContain(
      "enter vat yourself"
    );
  });
});
