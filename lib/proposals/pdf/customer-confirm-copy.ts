/**
 * Rewrites AI / internal confirmation wording into professional
 * customer-facing language for proposal PDFs.
 *
 * Internal trader checklist labels stay separate in quote-readiness.ts.
 */

const SITE_VISIT_CUSTOMER =
  "Site visit recommended to confirm measurements.";

const MEASUREMENTS_CUSTOMER = "Measurements to be confirmed.";
const MATERIALS_CUSTOMER = "Materials to be confirmed.";
const ACCESS_CUSTOMER = "Access arrangements to be confirmed.";
const DATES_CUSTOMER = "Dates to be confirmed.";

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
    match: /^site visit recommended to confirm (final )?measurements.*$/i,
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
    replacement: DATES_CUSTOMER,
  },
  {
    match: /^start date to (be )?confirm(ed)?\.?$/i,
    replacement: DATES_CUSTOMER,
  },
  {
    match: /^dates? to (be )?confirm(ed)?\.?$/i,
    replacement: DATES_CUSTOMER,
  },
  {
    match: /^confirm estimated duration\.?$/i,
    replacement: DATES_CUSTOMER,
  },
  {
    match: /^duration to confirm\.?$/i,
    replacement: DATES_CUSTOMER,
  },
  {
    match: /^timescale to (be )?confirm(ed)?\.?$/i,
    replacement: DATES_CUSTOMER,
  },
  {
    match: /^measurements?(\/dimensions)? to (be )?confirm(ed)?\.?$/i,
    replacement: MEASUREMENTS_CUSTOMER,
  },
  {
    match: /^final measurements to be confirmed\.?$/i,
    replacement: MEASUREMENTS_CUSTOMER,
  },
  {
    match: /^exact measurements?\b.*to (be )?confirm(ed)?\.?$/i,
    replacement: MEASUREMENTS_CUSTOMER,
  },
  {
    match: /^materials?(\/specifications?)? to (be )?confirm(ed)?\.?$/i,
    replacement: MATERIALS_CUSTOMER,
  },
  {
    match: /^materials and (specification|finishes) to be confirmed\.?$/i,
    replacement: MATERIALS_CUSTOMER,
  },
  {
    match: /^materials \/ specification to be confirmed\.?$/i,
    replacement: MATERIALS_CUSTOMER,
  },
  {
    match: /^access requirements? to (be )?confirm(ed)?\.?$/i,
    replacement: ACCESS_CUSTOMER,
  },
  {
    match: /^(site )?access arrangements? to be confirmed\.?$/i,
    replacement: ACCESS_CUSTOMER,
  },
  {
    match: /^site access to be confirmed\.?$/i,
    replacement: ACCESS_CUSTOMER,
  },
  {
    match: /^access to (be )?confirm(ed)?\.?$/i,
    replacement: ACCESS_CUSTOMER,
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
    replacement: MATERIALS_CUSTOMER,
  },
  {
    match: /^final finishes and choices to be confirmed\.?$/i,
    replacement: MATERIALS_CUSTOMER,
  },
  {
    match: /^customer choices to (be )?confirm(ed)?\.?$/i,
    replacement: MATERIALS_CUSTOMER,
  },
  {
    match: /^final (scope|job details)(\/details)? to (be )?confirm(ed)?\.?$/i,
    replacement: "Final job details to be confirmed.",
  },
  // Trader-only — never show on the customer PDF
  { match: /^customer (name|phone|email|contact).*$/i, replacement: null },
  { match: /^(full |job )?address to (be )?confirm(ed)?\.?$/i, replacement: null },
  { match: /^duration to (be )?confirm(ed)?\.?$/i, replacement: null },
  { match: /^pricing to complete\.?$/i, replacement: null },
  { match: /^payment terms to confirm\.?$/i, replacement: null },
  { match: /^customer quote total\.?$/i, replacement: null },
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

  if (
    /site\s+visit|site\s+inspection/i.test(trimmed) &&
    /measure|confirm|required|needed|find/i.test(trimmed)
  ) {
    return SITE_VISIT_CUSTOMER;
  }

  if (/measure|dimension/i.test(trimmed) && /confirm/i.test(trimmed)) {
    return MEASUREMENTS_CUSTOMER;
  }

  if (/material|finish|choice/i.test(trimmed) && /confirm/i.test(trimmed)) {
    return MATERIALS_CUSTOMER;
  }

  if (/access/i.test(trimmed) && /confirm/i.test(trimmed)) {
    return ACCESS_CUSTOMER;
  }

  if (
    /(start\s+date|timescale|duration|date)/i.test(trimmed) &&
    /confirm/i.test(trimmed)
  ) {
    return DATES_CUSTOMER;
  }

  if (/^confirm\s+/i.test(trimmed)) {
    return rewriteConfirmPrefix(trimmed);
  }

  return polishBareConfirmTopic(trimmed);
}

type ConfirmTopic =
  | "measurements"
  | "site_visit"
  | "access"
  | "materials"
  | "dates"
  | "photos"
  | "scope"
  | "other";

function classifyConfirmTopic(text: string): ConfirmTopic {
  if (/site visit recommended/i.test(text) || /^site visit\b/i.test(text)) {
    return "site_visit";
  }
  if (/measurement/i.test(text)) {
    return "measurements";
  }
  if (/access/i.test(text)) {
    return "access";
  }
  if (/material|finish|choice/i.test(text)) {
    return "materials";
  }
  if (/date|timescale|duration/i.test(text)) {
    return "dates";
  }
  if (/photo/i.test(text)) {
    return "photos";
  }
  if (/job detail|scope/i.test(text)) {
    return "scope";
  }
  return "other";
}

/**
 * Rewrite + collapse related confirm bullets so PDFs do not repeat
 * measurement / materials / date variants.
 */
export function toCustomerFacingThingsToConfirm(items: string[]): string[] {
  let hasMeasurements = false;
  let hasSiteVisit = false;
  let hasAccess = false;
  let hasMaterials = false;
  let hasDates = false;
  let hasPhotos = false;
  let hasScope = false;
  const others: string[] = [];
  const otherSeen = new Set<string>();

  for (const item of items) {
    const customer = toCustomerFacingConfirmItem(item);
    if (!customer) {
      continue;
    }

    const topic = classifyConfirmTopic(customer);
    switch (topic) {
      case "measurements":
        hasMeasurements = true;
        break;
      case "site_visit":
        hasSiteVisit = true;
        break;
      case "access":
        hasAccess = true;
        break;
      case "materials":
        hasMaterials = true;
        break;
      case "dates":
        hasDates = true;
        break;
      case "photos":
        hasPhotos = true;
        break;
      case "scope":
        hasScope = true;
        break;
      default: {
        const key = customer.toLowerCase();
        if (!otherSeen.has(key)) {
          otherSeen.add(key);
          others.push(customer);
        }
      }
    }
  }

  const result: string[] = [];

  if (hasMeasurements || hasSiteVisit) {
    result.push(MEASUREMENTS_CUSTOMER);
    if (hasSiteVisit) {
      result.push(SITE_VISIT_CUSTOMER);
    }
  }

  if (hasAccess) {
    result.push(ACCESS_CUSTOMER);
  }

  if (hasMaterials) {
    result.push(MATERIALS_CUSTOMER);
  }

  if (hasDates) {
    result.push(DATES_CUSTOMER);
  }

  if (hasPhotos) {
    result.push("Site photos and conditions to be confirmed.");
  }

  if (hasScope) {
    result.push("Final job details to be confirmed.");
  }

  result.push(...others);
  return result;
}

export const CUSTOMER_CONFIRM_COPY = {
  siteVisit: SITE_VISIT_CUSTOMER,
  measurements: MEASUREMENTS_CUSTOMER,
  materials: MATERIALS_CUSTOMER,
  access: ACCESS_CUSTOMER,
  photos: "Site photos and conditions to be confirmed.",
  choices: MATERIALS_CUSTOMER,
  startDate: DATES_CUSTOMER,
  duration: DATES_CUSTOMER,
  dates: DATES_CUSTOMER,
  finalScope: "Final job details to be confirmed.",
} as const;
