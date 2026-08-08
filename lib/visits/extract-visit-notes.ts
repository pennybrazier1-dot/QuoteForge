/**
 * On-device fallback when AI is unavailable — quiet line matching only.
 * Prefer organiseVisitNotesWithAi in the trader UI.
 */

import {
  EMPTY_VISIT_NOTES_ORGANISED,
  type VisitNotesOrganised,
} from "@/lib/visits/organise-visit-notes";

const PATTERNS: Array<{ key: keyof VisitNotesOrganised; pattern: RegExp }> = [
  {
    key: "measurements",
    pattern:
      /\b(measure|measurement|mm|cm|metre|meter|length|width|height|size|approx)\b/i,
  },
  {
    key: "materials",
    pattern:
      /\b(material|materials|tile|tiles|wood|timber|paint|finish|suite|brick|concrete)\b/i,
  },
  {
    key: "access",
    pattern:
      /\b(access|parking|park|alley|stairs|scaffold|permission|key|gate)\b/i,
  },
  {
    key: "siteConditions",
    pattern:
      /\b(damp|condition|uneven|damage|rotted|asbestos|existing|substrate|floor)\b/i,
  },
  {
    key: "requirements",
    pattern:
      /\b(need|needs|require|required|wants?|scope|replace|install|refit|remove)\b/i,
  },
  {
    key: "customerChoices",
    pattern:
      /\b(prefer|prefers|chose|chosen|choice|colour|color|style|brand|finish)\b/i,
  },
  {
    key: "timing",
    pattern:
      /\b(timing|duration|days?|weeks?|start|asap|deadline|month|morning|afternoon)\b/i,
  },
];

/** @deprecated Use extractOrganisedVisitNotes — kept for older imports. */
export type VisitNotesExtract = VisitNotesOrganised;

export function extractOrganisedVisitNotes(notes: string): VisitNotesOrganised {
  const cleaned = notes.replace(/\r\n/g, "\n").trim();
  if (!cleaned) {
    return { ...EMPTY_VISIT_NOTES_ORGANISED };
  }

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const result: VisitNotesOrganised = { ...EMPTY_VISIT_NOTES_ORGANISED };
  const claimed = new Set<string>();

  for (const { key, pattern } of PATTERNS) {
    const matched = lines.filter((line) => pattern.test(line));
    if (matched.length > 0) {
      result[key] = matched.join("\n");
      for (const line of matched) {
        claimed.add(line);
      }
    }
  }

  const leftover = lines.filter((line) => !claimed.has(line)).join("\n");
  if (leftover && !result.requirements) {
    result.requirements = leftover;
  } else if (leftover) {
    result.requirements = [result.requirements, leftover]
      .filter(Boolean)
      .join("\n");
  }

  if (!PATTERNS.some(({ key }) => result[key])) {
    return {
      ...EMPTY_VISIT_NOTES_ORGANISED,
      requirements: cleaned,
    };
  }

  return result;
}

/** @deprecated Prefer extractOrganisedVisitNotes */
export function extractVisitNotes(notes: string): VisitNotesOrganised {
  return extractOrganisedVisitNotes(notes);
}
