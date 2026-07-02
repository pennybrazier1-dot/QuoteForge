const CONVERSATIONAL_PATTERN =
  /\b(?:please|thanks|thank you|asap|a\.s\.a\.p|hurry|urgently|urgent|cheers|ta)\b/gi;

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlapRatio(a: string, b: string): number {
  const tokensA = new Set(
    normalizeKey(a)
      .split(" ")
      .filter((token) => token.length > 2)
  );
  const tokensB = normalizeKey(b)
    .split(" ")
    .filter((token) => token.length > 2);

  if (tokensA.size === 0 || tokensB.length === 0) {
    return 0;
  }

  const overlap = tokensB.filter((token) => tokensA.has(token)).length;
  return overlap / tokensB.length;
}

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function refineJobSummary(jobSummary: string): string {
  const trimmed = jobSummary.trim();
  if (!trimmed) {
    return trimmed;
  }

  const sentences = splitSentences(trimmed);
  if (sentences.length <= 2) {
    return sentences.join(" ");
  }

  return sentences.slice(0, 2).join(" ");
}

function scopeRepeatsSummary(scopeItem: string, jobSummary: string): boolean {
  const scopeKey = normalizeKey(scopeItem);
  const summaryKey = normalizeKey(jobSummary);

  if (!scopeKey || !summaryKey) {
    return false;
  }

  if (scopeKey === summaryKey) {
    return true;
  }

  // Only drop scope bullets that paraphrase the whole job summary — not individual workflow tasks.
  if (
    scopeKey.length > 20 &&
    (summaryKey.includes(scopeKey) || scopeKey.includes(summaryKey)) &&
    scopeKey.length >= summaryKey.length * 0.55
  ) {
    return true;
  }

  return tokenOverlapRatio(scopeItem, jobSummary) >= 0.88;
}

function normalizeScopeBullet(item: string): string {
  const trimmed = item.trim().replace(/[.]+$/, "");
  if (!trimmed) {
    return trimmed;
  }

  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return `${capitalized}.`;
}

export function refineScopeOfWork(
  scopeOfWork: string[],
  jobSummary: string
): string[] {
  const seen = new Set<string>();
  const refined: string[] = [];

  for (const item of scopeOfWork.map((entry) => entry.trim()).filter(Boolean)) {
    if (scopeRepeatsSummary(item, jobSummary)) {
      continue;
    }

    const normalized = normalizeScopeBullet(item);
    const key = normalizeKey(normalized);
    if (seen.has(key)) {
      continue;
    }

    const duplicatesEarlier = refined.some(
      (existing) =>
        normalizeKey(existing) === key ||
        tokenOverlapRatio(existing, normalized) >= 0.9
    );
    if (duplicatesEarlier) {
      continue;
    }

    seen.add(key);
    refined.push(normalized);
  }

  return refined;
}

function ensureSentence(text: string): string {
  const trimmed = text.trim().replace(/[.,;]+$/, "");
  if (!trimmed) {
    return trimmed;
  }

  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function inferSupplyAndFitPhrase(text: string): string | null {
  const lower = text.toLowerCase();

  const doorMatch = lower.match(
    /\b(?:new\s+)?(?:replacement\s+)?(?:(bathroom|kitchen|bedroom|external|front|rear)\s+)?door\b/
  );
  if (doorMatch) {
    const room = doorMatch[1];
    return room
      ? `Supply and fit a replacement ${room} door.`
      : "Supply and fit a replacement door.";
  }

  if (/\b(?:socket|sockets|lighting|light|switch|tap|radiator|towel rail)\b/.test(lower)) {
    if (/^supply\b|^install\b|^fit\b|^replace\b/.test(lower)) {
      return ensureSentence(text);
    }
    const remainder = text.charAt(0).toLowerCase() + text.slice(1);
    return ensureSentence(`Supply and fit ${remainder}`);
  }

  if (/^supply\b|^install\b|^fit\b|^replace\b/.test(lower)) {
    return ensureSentence(text);
  }

  return null;
}

export function professionalizeOptionalExtra(item: string): string {
  let text = item
    .trim()
    .replace(CONVERSATIONAL_PATTERN, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-•]\s*/, "")
    .trim();

  if (!text) {
    return item.trim();
  }

  const inferred = inferSupplyAndFitPhrase(text);
  if (inferred) {
    return inferred;
  }

  return ensureSentence(text);
}

export function refineOptionalExtras(optionalExtras: string[]): string[] {
  const seen = new Set<string>();

  return optionalExtras
    .map((item) => professionalizeOptionalExtra(item))
    .filter((item) => {
      const key = normalizeKey(item);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}
