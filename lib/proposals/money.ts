export function parsePriceToPence(value: string): number | null {
  const cleaned = value.replace(/[£,\s]/g, "").trim();
  if (!cleaned) {
    return 0;
  }

  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}

export function formatPenceAsGbp(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}

export function formatPenceForInput(pence: number): string {
  if (pence % 100 === 0) {
    return String(pence / 100);
  }

  return (pence / 100).toFixed(2);
}

/** Pull the first £ amount from free-text notes when no formal price was saved. */
export function extractPriceFromText(
  ...texts: Array<string | null | undefined>
): number | null {
  for (const text of texts) {
    if (!text?.trim()) {
      continue;
    }

    const poundMatch = text.match(/£\s*(\d[\d,]*(?:\.\d{2})?)/i);
    if (poundMatch) {
      const pence = parsePriceToPence(poundMatch[1]);
      if (pence !== null && pence > 0) {
        return pence;
      }
    }

    const wordMatch = text.match(/\b(\d[\d,]*)\s*(?:pounds?|gbp)\b/i);
    if (wordMatch) {
      const pence = parsePriceToPence(wordMatch[1]);
      if (pence !== null && pence > 0) {
        return pence;
      }
    }
  }

  return null;
}

/** Prefer saved total_amount; fall back to prices mentioned in site notes. */
export function resolveProposalPricePence(
  totalAmount: number,
  ...fallbackTexts: Array<string | null | undefined>
): number {
  if (totalAmount > 0) {
    return totalAmount;
  }

  return extractPriceFromText(...fallbackTexts) ?? 0;
}
