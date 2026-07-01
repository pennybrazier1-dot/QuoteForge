/**
 * Server-side name formatting for people and businesses.
 * Applied before database writes so stored values display consistently.
 */

const NAME_PARTICLES = new Set([
  "van",
  "von",
  "de",
  "da",
  "del",
  "della",
  "di",
  "du",
  "la",
  "le",
  "der",
  "den",
  "ten",
  "ter",
  "st",
  "st.",
]);

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function capitalizeSegment(segment: string): string {
  if (!segment) {
    return segment;
  }

  const lower = segment.toLowerCase();

  const mcMatch = lower.match(/^mc([a-z].*)$/);
  if (mcMatch) {
    return `Mc${capitalizeSegment(mcMatch[1])}`;
  }

  const macMatch = lower.match(/^mac([a-z]{3,})$/);
  if (macMatch) {
    return `Mac${capitalizeSegment(macMatch[1])}`;
  }

  return lower
    .split(/(['-])/)
    .map((part, index, parts) => {
      if (part === "'" || part === "-") {
        return part;
      }

      if (!part) {
        return part;
      }

      if (parts[index - 1] === "'") {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

function formatNameToken(token: string, index: number): string {
  const lower = token.toLowerCase();

  if (index > 0 && NAME_PARTICLES.has(lower)) {
    return lower;
  }

  return capitalizeSegment(token);
}

/**
 * Formats a person's name into title case.
 * Examples: "james lock" → "James Lock", "O'CONNOR" → "O'Connor"
 */
export function formatPersonName(name: string): string {
  const collapsed = collapseWhitespace(name);
  if (!collapsed) {
    return collapsed;
  }

  return collapsed
    .split(" ")
    .map((token, index) => formatNameToken(token, index))
    .join(" ");
}

function isUniformLetterCase(value: string): boolean {
  const letters = value.replace(/[^a-zA-Z]/g, "");
  if (!letters) {
    return false;
  }

  return letters === letters.toLowerCase() || letters === letters.toUpperCase();
}

function formatBusinessToken(token: string): string {
  if (!token || !/[a-zA-Z]/.test(token)) {
    return token;
  }

  return capitalizeSegment(token);
}

/**
 * Formats business names when the user typed only upper or lower case.
 * Mixed-case input is preserved so intentional branding stays intact.
 * Examples: "smith plumbing" → "Smith Plumbing", "iFix Plumbing" → "iFix Plumbing"
 */
export function formatBusinessName(name: string): string {
  const collapsed = collapseWhitespace(name);
  if (!collapsed) {
    return collapsed;
  }

  if (!isUniformLetterCase(collapsed)) {
    return collapsed;
  }

  return collapsed
    .split(/(\s+|&)/)
    .map((part) => {
      if (/^\s+$/.test(part) || part === "&") {
        return part;
      }

      return formatBusinessToken(part);
    })
    .join("");
}
