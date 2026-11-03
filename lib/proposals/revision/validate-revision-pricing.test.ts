import { describe, expect, it } from "vitest";
import {
  linesFromMultiline,
  multilineFromLines,
  validateRevisionPricing,
} from "@/lib/proposals/revision/validate-revision-pricing";

describe("validateRevisionPricing", () => {
  it("keeps existing VAT and derives subtotal from revised total", () => {
    const result = validateRevisionPricing({
      totalPence: 92000,
      existingVatPence: 0,
    });
    expect(result).toEqual({
      ok: true,
      totalPence: 92000,
      vatPence: 0,
      subtotalPence: 92000,
    });
  });

  it("rejects zero or negative totals", () => {
    expect(
      validateRevisionPricing({ totalPence: 0, existingVatPence: 0 }).ok
    ).toBe(false);
    expect(
      validateRevisionPricing({ totalPence: -100, existingVatPence: 0 }).ok
    ).toBe(false);
  });

  it("rejects totals below existing VAT", () => {
    const result = validateRevisionPricing({
      totalPence: 1000,
      existingVatPence: 2000,
    });
    expect(result.ok).toBe(false);
  });

  it("preserves non-zero VAT without inventing a new rate", () => {
    const result = validateRevisionPricing({
      totalPence: 12000,
      existingVatPence: 2000,
    });
    expect(result).toEqual({
      ok: true,
      totalPence: 12000,
      vatPence: 2000,
      subtotalPence: 10000,
    });
  });
});

describe("revision line helpers", () => {
  it("splits and joins material lines", () => {
    expect(linesFromMultiline("Paint\n\nEggshell\n")).toEqual([
      "Paint",
      "Eggshell",
    ]);
    expect(multilineFromLines(["Paint", "Eggshell"])).toBe("Paint\nEggshell");
  });
});
