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
