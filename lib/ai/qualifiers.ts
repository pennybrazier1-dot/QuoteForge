const QUALIFIER_WORD_PATTERN =
  /\b(?:approximately|approx\.?|around|about|circa|may|might|could|subject to|depending on|if suitable|where possible|assuming|pending|unless|once confirmed)\b/i;

const QUALIFIER_CLAUSE_PATTERNS = [
  /\bdepending on\b[^.;\n]*/gi,
  /\bsubject to\b[^.;\n]*/gi,
  /\bif (?:suitable|appropriate|required|conditions allow|accessible)\b[^.;\n]*/gi,
  /\bwhere possible\b[^.;\n]*/gi,
  /\bpending\b[^.;\n]*/gi,
  /\bassuming\b[^.;\n]*/gi,
  /\bunless\b[^.;\n]*/gi,
  /\bonce confirmed\b[^.;\n]*/gi,
  /\bmay (?:vary|change|differ|require)\b[^.;\n]*/gi,
  /\bmight (?:vary|change|differ|require)\b[^.;\n]*/gi,
];

const TIME_UNIT_PATTERN = /\b(?:hours?|days?|weeks?|months?|working days?)\b/i;

const PRICE_PATTERN = /£\s*\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*\s*(?:pounds?|gbp)\b/i;

const QUALIFIER_WORDS_TO_STRIP = [
  "approximately",
  "approx",
  "around",
  "about",
  "circa",
  "may",
  "might",
  "could",
  "subject to",
  "depending on",
  "if suitable",
  "where possible",
  "assuming",
  "pending",
  "unless",
  "once confirmed",
];

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[£,]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripQualifierWords(text: string): string {
  let result = text.toLowerCase();

  for (const word of QUALIFIER_WORDS_TO_STRIP) {
    result = result.replace(new RegExp(`\\b${word}\\b`, "gi"), " ");
  }

  return result.replace(/\s+/g, " ").trim();
}

function tokenize(text: string): string[] {
  return normalizeForComparison(text)
    .split(" ")
    .filter((token) => token.length > 2);
}

export function containsQualifier(text: string): boolean {
  return QUALIFIER_WORD_PATTERN.test(text);
}

export function extractQualifierClauses(text: string): string[] {
  const clauses = new Set<string>();

  for (const pattern of QUALIFIER_CLAUSE_PATTERNS) {
    const matches = text.match(pattern) ?? [];
    for (const match of matches) {
      const trimmed = match.trim().replace(/[.,;]+$/, "");
      if (trimmed) {
        clauses.add(trimmed);
      }
    }
  }

  return [...clauses];
}

function splitSourceSegments(sourceText: string): string[] {
  const protectedText = sourceText.replace(/(\d),(\d{3})/g, "$1__THOUSAND__$2");

  return protectedText
    .split(/(?<=[.!?])\s+|\n+|;|\s*,\s+/)
    .map((segment) => segment.replace(/__THOUSAND__/g, ",").trim())
    .filter(Boolean);
}

function isRelatedContent(output: string, sourceSegment: string): boolean {
  const outputCore = stripQualifierWords(normalizeForComparison(output));
  const sourceCore = stripQualifierWords(normalizeForComparison(sourceSegment));

  if (!outputCore || !sourceCore) {
    return false;
  }

  if (sourceCore.includes(outputCore) || outputCore.includes(sourceCore)) {
    return true;
  }

  const outputTokens = new Set(tokenize(output));
  const sourceTokens = tokenize(sourceSegment);
  const overlap = sourceTokens.filter((token) => outputTokens.has(token));

  return overlap.length >= Math.min(2, sourceTokens.length);
}

function missingQualifierClauses(output: string, sourceSegment: string): string[] {
  const sourceClauses = extractQualifierClauses(sourceSegment);

  return sourceClauses.filter((clause) => {
    const normalizedClause = normalizeForComparison(clause);
    return !normalizeForComparison(output).includes(normalizedClause);
  });
}

function hasWeakenedQualifiers(output: string, sourceSegment: string): boolean {
  if (!containsQualifier(sourceSegment)) {
    return false;
  }

  if (missingQualifierClauses(output, sourceSegment).length > 0) {
    return true;
  }

  const outputHasSoftener = containsQualifier(output);
  const sourceHasSoftener = containsQualifier(sourceSegment);

  return sourceHasSoftener && !outputHasSoftener && isRelatedContent(output, sourceSegment);
}

function appendClauses(text: string, clauses: string[]): string {
  let result = text.trim().replace(/[.,;]+$/, "");

  for (const clause of clauses) {
    const normalizedClause = normalizeForComparison(clause);
    if (!normalizeForComparison(result).includes(normalizedClause)) {
      result = `${result} ${clause.trim()}`;
    }
  }

  return `${result.trim()}.`.replace(/\.\.+$/, ".").replace(/\s+/g, " ");
}

export function enrichWithSourceQualifiers(
  output: string,
  sourceText: string,
  options?: { allowSegmentReplace?: boolean }
): string {
  const trimmedOutput = output.trim();
  const allowSegmentReplace = options?.allowSegmentReplace ?? true;

  if (!trimmedOutput || !sourceText.trim()) {
    return trimmedOutput;
  }

  let enriched = trimmedOutput;

  for (const segment of splitSourceSegments(sourceText)) {
    if (!containsQualifier(segment) || !isRelatedContent(enriched, segment)) {
      continue;
    }

    if (hasWeakenedQualifiers(enriched, segment)) {
      const clauses = missingQualifierClauses(enriched, segment);

      if (clauses.length > 0) {
        enriched = appendClauses(enriched, clauses);
        continue;
      }

      if (
        allowSegmentReplace &&
        segment.length > enriched.length &&
        stripQualifierWords(normalizeForComparison(segment)).includes(
          stripQualifierWords(normalizeForComparison(enriched))
        )
      ) {
        enriched = segment.replace(/[.,;]+$/, "").trim() + ".";
      }
    }
  }

  return enriched;
}

function findBestQualifiedDurationFragment(sourceText: string): string | null {
  const candidates = splitSourceSegments(sourceText).filter(
    (segment) => containsQualifier(segment) && TIME_UNIT_PATTERN.test(segment)
  );

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
}

export function preserveQualifiedDuration(
  estimatedDuration: string,
  siteNotes: string,
  manualDuration: string | null
): string {
  if (manualDuration?.trim()) {
    return estimatedDuration.trim();
  }

  const safeFallback =
    "Estimated duration cannot yet be determined from the information provided.";
  const trimmed = estimatedDuration.trim();
  const qualifiedFragment = findBestQualifiedDurationFragment(siteNotes);

  if (trimmed === safeFallback) {
    if (qualifiedFragment) {
      return qualifiedFragment.replace(/[.,;]+$/, "").trim() + ".";
    }
    return trimmed;
  }

  if (!qualifiedFragment) {
    return trimmed;
  }

  if (isRelatedContent(trimmed, qualifiedFragment)) {
    return enrichWithSourceQualifiers(trimmed, qualifiedFragment, {
      allowSegmentReplace: false,
    });
  }

  return enrichWithSourceQualifiers(trimmed, qualifiedFragment, {
    allowSegmentReplace: false,
  });
}

function findQualifiedPriceFragments(sourceText: string): string[] {
  return splitSourceSegments(sourceText).filter(
    (segment) => containsQualifier(segment) && PRICE_PATTERN.test(segment)
  );
}

export function preserveQualifiedLabour(
  labour: string,
  siteNotes: string,
  manualPrice: string | null
): string {
  let enriched = enrichWithSourceQualifiers(labour, siteNotes);

  if (manualPrice?.trim()) {
    return enriched;
  }

  for (const fragment of findQualifiedPriceFragments(siteNotes)) {
    if (isRelatedContent(enriched, fragment)) {
      enriched = enrichWithSourceQualifiers(enriched, fragment);
    }
  }

  return enriched;
}

export function preserveQualifiedStringList(
  items: string[],
  siteNotes: string,
  options?: { allowSegmentReplace?: boolean }
): string[] {
  return items.map((item) =>
    enrichWithSourceQualifiers(item, siteNotes, options)
  );
}

export function preserveQualifiedScopeItems(
  items: string[],
  siteNotes: string
): string[] {
  return preserveQualifiedStringList(items, siteNotes, {
    allowSegmentReplace: false,
  });
}

function qualifierClauseToConfirmItem(clause: string): string | null {
  const dependingMatch = clause.match(/\bdepending on\s+(.+)/i);
  if (dependingMatch) {
    const condition = dependingMatch[1].trim().replace(/[.,;]+$/, "");
    return `${capitalizeFirst(condition)} — to be confirmed before finalising the proposal`;
  }

  const subjectMatch = clause.match(/\bsubject to\s+(.+)/i);
  if (subjectMatch) {
    const condition = subjectMatch[1].trim().replace(/[.,;]+$/, "");
    return `${capitalizeFirst(condition)} — subject to confirmation before work begins`;
  }

  if (/\bif suitable\b/i.test(clause)) {
    return "Suitability of materials or approach on site — to be confirmed";
  }

  if (/\bwhere possible\b/i.test(clause)) {
    return "Practical constraints on site — to be confirmed where work is feasible";
  }

  return null;
}

function capitalizeFirst(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function addQualifierConfirmations(
  thingsToConfirm: string[],
  siteNotes: string,
  proposalText: string
): string[] {
  const next = [...thingsToConfirm];
  const combinedProposalText = normalizeForComparison(proposalText);

  for (const segment of splitSourceSegments(siteNotes)) {
    if (!containsQualifier(segment)) {
      continue;
    }

    for (const clause of extractQualifierClauses(segment)) {
      const confirmItem = qualifierClauseToConfirmItem(clause);

      if (!confirmItem) {
        continue;
      }

      const normalizedItem = normalizeForComparison(confirmItem);
      const alreadyListed = next.some(
        (item) => normalizeForComparison(item) === normalizedItem
      );
      const reflectedInProposal = combinedProposalText.includes(
        normalizeForComparison(clause)
      );

      if (!alreadyListed && (!reflectedInProposal || clause.length > 20)) {
        next.push(confirmItem);
      }
    }
  }

  return next;
}
