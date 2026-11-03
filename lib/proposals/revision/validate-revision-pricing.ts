/**
 * Pricing rules for Stage 2G proposal revisions.
 * Preserves existing VAT treatment — does not invent tax.
 */

export type RevisionPricingInput = {
  totalPence: number;
  existingVatPence: number;
};

export type RevisionPricingResult =
  | {
      ok: true;
      totalPence: number;
      vatPence: number;
      subtotalPence: number;
    }
  | { ok: false; error: string };

export function validateRevisionPricing(
  input: RevisionPricingInput
): RevisionPricingResult {
  const totalPence = Math.round(input.totalPence);
  const vatPence = Math.round(input.existingVatPence);

  if (!Number.isFinite(totalPence) || totalPence <= 0) {
    return { error: "Please enter a valid revised total greater than zero.", ok: false };
  }

  if (!Number.isFinite(vatPence) || vatPence < 0) {
    return { error: "Existing VAT on this proposal is invalid.", ok: false };
  }

  if (totalPence < vatPence) {
    return {
      ok: false,
      error: "Revised total cannot be less than the existing VAT amount.",
    };
  }

  return {
    ok: true,
    totalPence,
    vatPence,
    subtotalPence: totalPence - vatPence,
  };
}

export function linesFromMultiline(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function multilineFromLines(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "description" in item) {
          return String((item as { description?: unknown }).description ?? "");
        }
        return String(item ?? "");
      })
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "string") return value;
  return "";
}
