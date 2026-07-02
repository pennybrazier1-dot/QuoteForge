/**
 * Development helper — logs DOM nodes wider than the viewport.
 * Call from a client component after layout (e.g. New Quote pages).
 */
export function logMobileOverflowElements(context = "page"): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const viewportWidth = window.innerWidth;
  const offenders: Array<{ tag: string; className: string; width: number }> = [];

  for (const element of document.querySelectorAll<HTMLElement>("body *")) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= viewportWidth + 1) {
      continue;
    }

    offenders.push({
      tag: element.tagName.toLowerCase(),
      className: element.className?.toString?.() ?? "",
      width: Math.round(rect.width),
    });
  }

  if (offenders.length === 0) {
    console.log(`[QuoteForge overflow] ${context}: no elements wider than viewport`);
    return;
  }

  console.warn(
    `[QuoteForge overflow] ${context}: ${offenders.length} element(s) wider than ${viewportWidth}px`,
    offenders.slice(0, 12)
  );
}
