/**
 * Rewrites AI / internal confirmation wording into professional
 * customer-facing language for proposal PDFs.
 *
 * Internal trader checklist labels stay separate in quote-readiness.ts.
 */

const SITE_VISIT_CUSTOMER =
  "Site visit recommended to confirm final measurements.";

const EXACT_REPLACEMENTS: Array<{ match: RegExp; replacement: string | null }> = [
  {
    match: /^what we find when we visit\.?$/i,
    replacement: SITE_VISIT_CUSTOMER,
  },
  {
    match: /^consider booking a site visit.*$/i,
    replacement: SITE_VISIT_CUSTOMER,
  },
  {
    match: /^site visit required\.?$/i,
    replacement: SITE_VISIT_CUSTOMER,
  },
  {
    match: /^a site visit may be needed before work begins\.?$/i,
    replacement: SITE_VISIT_CUSTOMER,
  },
  {
    match: /^site visit recommended to confirm final measurements.*$/i,
    replacement: SITE_VISIT_CUSTOMER,
  },
  {
    match: /^site visit to confirm\.?$/i,
    replacement: SITE_VISIT_CUSTOMER,
  },
  {
    match: /^site inspection to confirm\.?$/i,
    replacement: SITE_VISIT_CUSTOMER,
  },
  {
    match: /^confirm planned start date\.?$/i,
    replacement: "Start date to be confirmed.",
  },
  {
    match: /^start date to (be )?confirm(ed)?\.?$/i,
    replacement: "Start date to be confirmed.",
  },
  {
    match: /^confirm estimated duration\.?$/i,
    replacement: "Timescale to be confirmed.",
  },
  {
    match: /^duration to confirm\.?$/i,
    replacement: "Timescale to be confirmed.",
  },
  {
    match: /^measurements?(\/dimensions)? to (be )?confirm(ed)?\.?$/i,
    replacement: "Final measurements to be confirmed.",
  },
  {
    match: /^final measurements to be confirmed\.?$/i,
    replacement: "Final measurements to be confirmed.",
  },
  {
    match: /^materials?(\/specifications?)? to (be )?confirm(ed)?\.?$/i,
    replacement: "Materials and finishes to be confirmed.",
  },
  {
    match: /^materials and (specification|finishes) to be confirmed\.?$/i,
    replacement: "Materials and finishes to be confirmed.",
  },
  {
    match: /^materials \/ specification to be confirmed\.?$/i,
    replacement: "Materials and finishes to be confirmed.",
  },
  {
    match: /^access requirements? to (be )?confirm(ed)?\.?$/i,
    replacement: "Access arrangements to be confirmed.",
  },
  {
    match: /^(site )?access arrangements? to be confirmed\.?$/i,
    replacement: "Access arrangements to be confirmed.",
  },
  {
    match: /^site access to be confirmed\.?$/i,
    replacement: "Access arrangements to be confirmed.",
  },
  {
    match: /^photos?\/site conditions? to (be )?confirm(ed)?\.?$/i,
    replacement: "Site photos and conditions to be confirmed.",
  },
  {
    match: /^site photos (and|\/) conditions to be confirmed\.?$/i,
    replacement: "Site photos and conditions to be confirmed.",
  },
  {
    match: /^final choices \(for example finishes\) to be confirmed\.?$/i,
    replacement: "Materials and finishes to be confirmed.",
  },
  {
    match: /^final finishes and choices to be confirmed\.?$/i,
    replacement: "Materials and finishes to be confirmed.",
  },
  {
    match: /^customer choices to confirm\.?$/i,
    replacement: "Materials and finishes to be confirmed.",
  },
  {
    match: /^final (scope|job details)(\/details)? to (be )?confirm(ed)?\.?$/i,
    replacement: "Final job details to be confirmed.",
  },
  // Trader-only — never show on the customer PDF
  { match: /^customer contact details to confirm\.?$/i, replacement: null },
  { match: /^full address to confirm\.?$/i, replacement: null },
  { match: /^pricing to complete\.?$/i, replacement: null },
  { match: /^payment terms to confirm\.?$/i, replacement: null },
  { match: /^still to confirm later:.*$/i, replacement: null },
  { match: /\b(missing|ai detected|internal readiness)\b/i, replacement: null },
];

function ensureSentence(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }
  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}.`;
}

function rewriteConfirmPrefix(value: string): string {
  const confirmMatch = value.match(/^confirm\s+(.+)$/i);
  if (!confirmMatch?.[1]) {
    return value;
  }

  const rest = confirmMatch[1].trim().replace(/\.$/, "");
  if (!rest) {
    return value;
  }

  const capitalized = rest.charAt(0).toUpperCase() + rest.slice(1);
  return ensureSentence(`${capitalized} to be confirmed`);
}

function polishBareConfirmTopic(value: string): string {
  if (/\b(to be confirmed|recommended|required)\b/i.test(value)) {
    return ensureSentence(value);
  }

  const wordCount = value.trim().split(/\s+/).length;
  if (wordCount > 0 && wordCount <= 8 && !/[.!?]$/.test(value.trim())) {
    const trimmed = value.trim().replace(/\.$/, "");
    const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return ensureSentence(`${capitalized} to be confirmed`);
  }

  return ensureSentence(value);
}

/**
 * Convert one internal/AI confirm item into customer-facing copy.
 * Returns null when the item should not appear on the customer PDF.
 */
export function toCustomerFacingConfirmItem(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (/\b(missing|ai detected|internal readiness)\b/i.test(trimmed)) {
    return null;
  }

  for (const rule of EXACT_REPLACEMENTS) {
    if (rule.match.test(trimmed)) {
      return rule.replacement;
    }
  }

  if (/site\s+visit|site\s+inspection/i.test(trimmed) && /measure|confirm|required|needed|find/i.test(trimmed)) {
    return SITE_VISIT_CUSTOMER;
  }

  if (/^confirm\s+/i.test(trimmed)) {
    return rewriteConfirmPrefix(trimmed);
  }

  return polishBareConfirmTopic(trimmed);
}

export function toCustomerFacingThingsToConfirm(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const customer = toCustomerFacingConfirmItem(item);
    if (!customer) {
      continue;
    }
    const key = customer.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(customer);
  }

  return result;
}

export const CUSTOMER_CONFIRM_COPY = {
  siteVisit: SITE_VISIT_CUSTOMER,
  measurements: "Final measurements to be confirmed.",
  materials: "Materials and finishes to be confirmed.",
  access: "Access arrangements to be confirmed.",
  photos: "Site photos and conditions to be confirmed.",
  choices: "Materials and finishes to be confirmed.",
  startDate: "Start date to be confirmed.",
  duration: "Timescale to be confirmed.",
  finalScope: "Final job details to be confirmed.",
} as const;
