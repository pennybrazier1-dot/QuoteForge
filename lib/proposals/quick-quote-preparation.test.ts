import { describe, expect, it } from "vitest";
import {
  buildQuickQuoteOptionalExtras,
  createEmptyConfirmState,
  getUnconfirmedLabels,
  QUICK_QUOTE_CONFIRM_ITEMS,
  sumQuickQuoteCosts,
} from "@/lib/proposals/quick-quote-preparation";

describe("quick quote preparation helpers", () => {
  it("lists every confirm item as open by default", () => {
    const open = getUnconfirmedLabels(createEmptyConfirmState());
    expect(open).toHaveLength(QUICK_QUOTE_CONFIRM_ITEMS.length);
    expect(open).toContain("Measurements");
    expect(open).toContain("Customer expectations");
  });

  it("sums materials, labour, and additional costs", () => {
    expect(sumQuickQuoteCosts("100", "250.50", "49.50")).toBe("400");
    expect(sumQuickQuoteCosts("", "", "")).toBe("");
    expect(sumQuickQuoteCosts("abc", "10", "")).toBe("");
  });

  it("builds optional extras from notes, open checks, and pricing", () => {
    const confirmed = createEmptyConfirmState();
    confirmed.measurements = true;
    confirmed.materials = true;

    const text = buildQuickQuoteOptionalExtras({
      notes: "Customer prefers grey tiles.",
      confirmed,
      materials: "120",
      labour: "400",
      additional: "",
    });

    expect(text).toContain("Customer prefers grey tiles.");
    expect(text).toContain("Still to confirm:");
    expect(text).toContain("Access requirements");
    expect(text).not.toContain("Measurements");
    expect(text).toContain("Materials: £120");
    expect(text).toContain("Labour: £400");
  });
});
