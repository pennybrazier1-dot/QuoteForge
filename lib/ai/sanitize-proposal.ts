import type { GeneratedProposal } from "./types";
import { DURATION_CANNOT_DETERMINE_MESSAGE } from "./prompts";
import {
  CONFIRM_ESTIMATED_DURATION,
  expandOptionalExtraCandidates,
  extractDurationFromSiteNotes,
  extractEstimatedPriceDigits,
  extractOptionalExtrasFromSiteNotes,
  isValidExtractedPriceDigits,
  looksLikeInvalidDuration,
  looksLikeOptionalExtraTrigger,
  normalizeExtractedPriceDigits,
} from "./extract-from-site-notes";
import {
  refineJobSummary,
  refineOptionalExtras,
  refineScopeOfWork,
} from "./refine-proposal-structure";

const PAYMENT_PATTERN =
  /\b(payment terms?|deposit|invoice|balance due|payable|instalments?)\b/i;

/** Hard rule: labour must never contain pricing or duration wording. */
const LABOUR_FORBIDDEN_PATTERN =
  /£|\bpounds?\b|\bcost\b|\bprice\b|\btotal\b|\bweeks?\b|\bdays?\b|\bduration\b/i;

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSegments(text: string): string[] {
  const protectedText = text.replace(/(\d),(\d{3})/g, "$1__THOUSAND__$2");

  return protectedText
    .split(/(?<=[.!?])\s+|\n+|;|\s*,\s+/)
    .map((segment) => segment.replace(/__THOUSAND__/g, ",").trim())
    .filter(Boolean);
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

function looksLikeCustomerOrAddressLine(
  item: string,
  proposal: GeneratedProposal
): boolean {
  if (/@/.test(item) || /\b07\d{3}[\s-]?\d{6}\b/.test(item)) {
    return true;
  }

  if (/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i.test(item)) {
    return true;
  }

  const name = proposal.extractedCustomerName.trim();
  if (name.length > 2 && normalizeKey(item).includes(normalizeKey(name))) {
    return true;
  }

  const address = proposal.extractedPropertyAddress.trim();
  if (
    address.length > 10 &&
    normalizeKey(item).includes(normalizeKey(address.slice(0, Math.min(24, address.length))))
  ) {
    return true;
  }

  return false;
}

function looksLikeSiteNotesDump(item: string, siteNotes: string): boolean {
  const normalizedItem = normalizeKey(item);

  if (normalizedItem.length < 40) {
    return false;
  }

  for (const segment of splitSegments(siteNotes)) {
    const normalizedSegment = normalizeKey(segment);

    if (
      normalizedSegment === normalizedItem ||
      (normalizedSegment.length > 30 &&
        (normalizedSegment.includes(normalizedItem) ||
          normalizedItem.includes(normalizedSegment)))
    ) {
      return true;
    }

    if (tokenOverlapRatio(item, segment) >= 0.85) {
      return true;
    }
  }

  return false;
}

function duplicatesScopeItem(item: string, scopeOfWork: string[]): boolean {
  const normalizedItem = normalizeKey(item);

  return scopeOfWork.some((scopeItem) => {
    const normalizedScope = normalizeKey(scopeItem);

    if (!normalizedScope || !normalizedItem) {
      return false;
    }

    if (normalizedScope === normalizedItem) {
      return true;
    }

    if (
      normalizedItem.length > 20 &&
      (normalizedScope.includes(normalizedItem) ||
        normalizedItem.includes(normalizedScope))
    ) {
      return true;
    }

    return tokenOverlapRatio(item, scopeItem) >= 0.9;
  });
}

export function sanitizeExtractedPrice(
  proposal: GeneratedProposal,
  siteNotes: string,
  manualEstimatedPrice: string | null | undefined
): GeneratedProposal {
  if (manualEstimatedPrice?.trim()) {
    return proposal;
  }

  const existing = proposal.extractedEstimatedPrice.replace(/[£,\s]/g, "").trim();
  if (existing && isValidExtractedPriceDigits(existing)) {
    return {
      ...proposal,
      extractedEstimatedPrice: normalizeExtractedPriceDigits(existing),
    };
  }

  const fromNotes = extractEstimatedPriceDigits(siteNotes);
  if (!fromNotes) {
    return {
      ...proposal,
      extractedEstimatedPrice: "",
    };
  }

  return {
    ...proposal,
    extractedEstimatedPrice: fromNotes,
  };
}

export function sanitizeEstimatedDuration(
  proposal: GeneratedProposal,
  siteNotes: string,
  manualEstimatedDuration: string | null | undefined
): GeneratedProposal {
  if (manualEstimatedDuration?.trim()) {
    return proposal;
  }

  const duration = proposal.estimatedDuration.trim();
  let nextDuration = duration;
  let thingsToConfirm = [...proposal.thingsToConfirm];

  if (!duration || looksLikeInvalidDuration(duration)) {
    const fromNotes = extractDurationFromSiteNotes(siteNotes);
    if (fromNotes && !looksLikeInvalidDuration(fromNotes)) {
      nextDuration = fromNotes;
    } else {
      nextDuration = DURATION_CANNOT_DETERMINE_MESSAGE;
      if (!thingsToConfirm.some((item) => /confirm estimated duration/i.test(item))) {
        thingsToConfirm = [...thingsToConfirm, CONFIRM_ESTIMATED_DURATION];
      }
    }
  }

  return {
    ...proposal,
    estimatedDuration: nextDuration,
    thingsToConfirm,
  };
}

export { extractOptionalExtrasFromSiteNotes };

function removeOptionalExtrasFromOtherSections(
  proposal: GeneratedProposal,
  optionalExtras: string[]
): GeneratedProposal {
  if (optionalExtras.length === 0) {
    return proposal;
  }

  const extraKeys = new Set(optionalExtras.map((item) => normalizeKey(item)));

  const shouldRemove = (text: string) => {
    const key = normalizeKey(text);
    if (!key) {
      return false;
    }

    return [...extraKeys].some(
      (extraKey) => key.includes(extraKey) || extraKey.includes(key)
    );
  };

  return {
    ...proposal,
    scopeOfWork: proposal.scopeOfWork.filter((item) => !shouldRemove(item)),
    materials: proposal.materials.filter((item) => !shouldRemove(item)),
    thingsToConfirm: proposal.thingsToConfirm.filter((item) => !shouldRemove(item)),
  };
}

export function sanitizeMaterials(
  materials: string[],
  proposal: GeneratedProposal,
  siteNotes: string
): string[] {
  const seen = new Set<string>();

  return materials
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) {
        return false;
      }

      const key = normalizeKey(item);
      if (seen.has(key)) {
        return false;
      }

      if (duplicatesScopeItem(item, proposal.scopeOfWork)) {
        return false;
      }

      if (looksLikeSiteNotesDump(item, siteNotes)) {
        return false;
      }

      if (looksLikeCustomerOrAddressLine(item, proposal)) {
        return false;
      }

      if (looksLikeOptionalExtraTrigger(item)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function labourContainsForbiddenContent(text: string): boolean {
  return LABOUR_FORBIDDEN_PATTERN.test(text);
}

function scopeItemToLabourPhrase(item: string): string {
  const phrase = item.trim().replace(/[.]+$/, "");
  return phrase.charAt(0).toLowerCase() + phrase.slice(1);
}

function labourFromScope(scopeOfWork: string[]): string {
  if (scopeOfWork.length === 0) {
    return "Labour and installation work as detailed in the scope of work.";
  }

  const phrases = scopeOfWork.map(scopeItemToLabourPhrase).filter(Boolean);

  if (phrases.length === 1) {
    return `Labour to ${phrases[0]}.`;
  }

  const last = phrases[phrases.length - 1]!;
  const rest = phrases.slice(0, -1);
  return `Labour to ${rest.join(", ")}, and ${last}.`;
}

export function sanitizeLabour(proposal: GeneratedProposal): string {
  const raw = proposal.labour.trim();

  if (!raw || labourContainsForbiddenContent(raw)) {
    return labourFromScope(proposal.scopeOfWork);
  }

  const withoutPayment = raw
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !PAYMENT_PATTERN.test(sentence))
    .join(" ")
    .trim();

  if (!withoutPayment || labourContainsForbiddenContent(withoutPayment)) {
    return labourFromScope(proposal.scopeOfWork);
  }

  if (!/^labour\b/i.test(withoutPayment)) {
    const normalized = withoutPayment.charAt(0).toLowerCase() + withoutPayment.slice(1);
    return `Labour to ${normalized.replace(/[.]+$/, "")}.`;
  }

  return withoutPayment;
}

function confirmsProvidedCustomerField(
  item: string,
  proposal: GeneratedProposal
): boolean {
  const lower = item.toLowerCase();

  if (
    proposal.extractedCustomerName.trim() &&
    /\b(customer|client)\b/.test(lower) &&
    /\bname\b/.test(lower) &&
    /\b(confirm|verify|check|provide|missing)\b/.test(lower)
  ) {
    return true;
  }

  if (
    proposal.extractedPropertyAddress.trim() &&
    /\b(address|property|site)\b/.test(lower) &&
    /\b(confirm|verify|check|provide|missing)\b/.test(lower)
  ) {
    return true;
  }

  if (
    proposal.extractedPhoneNumber.trim() &&
    /\b(phone|mobile|telephone|contact number)\b/.test(lower) &&
    /\b(confirm|verify|check|provide|missing)\b/.test(lower)
  ) {
    return true;
  }

  if (
    proposal.extractedEmailAddress.trim() &&
    /\b(email|e-mail)\b/.test(lower) &&
    /\b(confirm|verify|check|provide|missing)\b/.test(lower)
  ) {
    return true;
  }

  if (
    proposal.extractedCustomerName.trim() &&
    proposal.extractedPropertyAddress.trim() &&
    proposal.extractedPhoneNumber.trim() &&
    proposal.extractedEmailAddress.trim() &&
    /\bcustomer details?\b/.test(lower) &&
    /\b(confirm|verify|check|provide|missing)\b/.test(lower)
  ) {
    return true;
  }

  return false;
}

export function sanitizeThingsToConfirm(
  thingsToConfirm: string[],
  proposal: GeneratedProposal
): string[] {
  const seen = new Set<string>();

  return thingsToConfirm
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) {
        return false;
      }

      if (confirmsProvidedCustomerField(item, proposal)) {
        return false;
      }

      if (looksLikeOptionalExtraTrigger(item)) {
        return false;
      }

      const key = normalizeKey(item);
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export function sanitizeOptionalExtras(
  optionalExtras: string[],
  siteNotes: string
): string[] {
  const expandedAiItems = expandOptionalExtraCandidates(optionalExtras);
  const merged = extractOptionalExtrasFromSiteNotes(siteNotes, expandedAiItems);
  return refineOptionalExtras(merged);
}

export function sanitizeGeneratedProposal(
  proposal: GeneratedProposal,
  siteNotes: string,
  manualEstimatedPrice?: string | null,
  manualEstimatedDuration?: string | null
): GeneratedProposal {
  let next = sanitizeExtractedPrice(proposal, siteNotes, manualEstimatedPrice);
  next = sanitizeEstimatedDuration(next, siteNotes, manualEstimatedDuration);

  const optionalExtras = sanitizeOptionalExtras(next.optionalExtras, siteNotes);
  next = {
    ...next,
    optionalExtras,
  };

  next = removeOptionalExtrasFromOtherSections(next, optionalExtras);

  const jobSummary = refineJobSummary(next.jobSummary);
  const scopeOfWork = refineScopeOfWork(next.scopeOfWork, jobSummary);

  return {
    ...next,
    jobSummary,
    scopeOfWork,
    labour: sanitizeLabour({ ...next, scopeOfWork }),
    materials: sanitizeMaterials(next.materials, { ...next, scopeOfWork }, siteNotes),
    thingsToConfirm: sanitizeThingsToConfirm(next.thingsToConfirm, next),
  };
}
