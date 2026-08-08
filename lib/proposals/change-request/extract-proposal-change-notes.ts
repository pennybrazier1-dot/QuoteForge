/**
 * Silent structured extract from trader change notes.
 * Used on the Update proposal notes screen — no AI labels in UI.
 */

export type ProposalChangeExtract = {
  scopeNotes: string;
  materialsNotes: string;
  durationNotes: string;
  priceNotes: string;
  detailNotes: string;
};

const SCOPE_PATTERN =
  /\b(scope|include|including|add|remove|also|extra work|additional|tiling|plaster|install|fit|garden wall|hallway)\b/i;
const MATERIALS_PATTERN =
  /\b(material|materials|tile|tiles|oak|pine|grey|gray|colour|color|finish|paint|wood|timber|suite)\b/i;
const DURATION_PATTERN =
  /\b(\d+\s*(?:day|days|week|weeks)|longer|shorter|duration|take longer|extra day)\b/i;
const PRICE_PATTERN =
  /\b(price|pricing|cost|budget|discount|£|\bGBP\b|pounds?|cheaper|expensive|quote)\b/i;

function matchingLines(pattern: RegExp, lines: string[]): string[] {
  return lines.filter((line) => pattern.test(line));
}

/**
 * Heuristic split of free-text change notes into review fields.
 * Never writes to the live proposal.
 */
export function extractProposalChangeNotes(notes: string): ProposalChangeExtract {
  const cleaned = notes.replace(/\r\n/g, "\n").trim();
  if (!cleaned) {
    return {
      scopeNotes: "",
      materialsNotes: "",
      durationNotes: "",
      priceNotes: "",
      detailNotes: "",
    };
  }

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const scopeLines = matchingLines(SCOPE_PATTERN, lines);
  const materialsLines = matchingLines(MATERIALS_PATTERN, lines);
  const durationLines = matchingLines(DURATION_PATTERN, lines);
  const priceLines = matchingLines(PRICE_PATTERN, lines);

  const claimed = new Set([
    ...scopeLines,
    ...materialsLines,
    ...durationLines,
    ...priceLines,
  ]);

  const detailLines = lines.filter((line) => !claimed.has(line));

  const scopeNotes = scopeLines.join("\n");
  const materialsNotes = materialsLines.join("\n");
  const durationNotes = durationLines.join("\n");
  const priceNotes = priceLines.join("\n");
  const detailNotes = detailLines.join("\n");

  if (
    !scopeNotes &&
    !materialsNotes &&
    !durationNotes &&
    !priceNotes &&
    !detailNotes
  ) {
    return {
      scopeNotes: "",
      materialsNotes: "",
      durationNotes: "",
      priceNotes: "",
      detailNotes: cleaned,
    };
  }

  return {
    scopeNotes,
    materialsNotes,
    durationNotes,
    priceNotes,
    detailNotes,
  };
}
