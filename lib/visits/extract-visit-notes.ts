/**
 * Quiet structured extract from visit notes (same pattern as proposal change notes).
 * No AI labels in UI — heuristic only.
 */

export type VisitNotesExtract = {
  measurements: string;
  accessNotes: string;
  materialsNotes: string;
  followUpNotes: string;
};

const MEASURE_PATTERN =
  /\b(measure|measurement|mm|cm|metre|meter|length|width|height|size)\b/i;
const ACCESS_PATTERN =
  /\b(access|parking|alley|stairs|scaffold|permission|key|gate)\b/i;
const MATERIALS_PATTERN =
  /\b(material|materials|tile|tiles|wood|timber|paint|finish|suite)\b/i;

function matchingLines(pattern: RegExp, lines: string[]): string[] {
  return lines.filter((line) => pattern.test(line));
}

export function extractVisitNotes(notes: string): VisitNotesExtract {
  const cleaned = notes.replace(/\r\n/g, "\n").trim();
  if (!cleaned) {
    return {
      measurements: "",
      accessNotes: "",
      materialsNotes: "",
      followUpNotes: "",
    };
  }

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const measurements = matchingLines(MEASURE_PATTERN, lines).join("\n");
  const accessNotes = matchingLines(ACCESS_PATTERN, lines).join("\n");
  const materialsNotes = matchingLines(MATERIALS_PATTERN, lines).join("\n");
  const claimed = new Set(
    [
      ...matchingLines(MEASURE_PATTERN, lines),
      ...matchingLines(ACCESS_PATTERN, lines),
      ...matchingLines(MATERIALS_PATTERN, lines),
    ]
  );
  const followUpNotes = lines.filter((line) => !claimed.has(line)).join("\n");

  if (!measurements && !accessNotes && !materialsNotes && !followUpNotes) {
    return {
      measurements: "",
      accessNotes: "",
      materialsNotes: "",
      followUpNotes: cleaned,
    };
  }

  return {
    measurements,
    accessNotes,
    materialsNotes,
    followUpNotes,
  };
}
