/**
 * UK-oriented validation for trader business profile fields.
 * Empty optional fields stay empty — never invent details.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Common UK formats: SW1A 1AA, M1 1AE, B33 8TH, etc. */
const UK_POSTCODE_PATTERN =
  /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
/** UK mobiles / landlines with optional +44. */
const UK_PHONE_PATTERN =
  /^(?:(?:\+?44\s?(?:\d\s?){9,10})|(?:0\d[\d\s-]{8,12}))$/;
/** Optional GB VAT: GB123456789, GB123456789012, or 9–12 digits. */
const UK_VAT_PATTERN =
  /^(?:GB)?(?:\d{9}|\d{12}|\d{3}\s?\d{4}\s?\d{2}\s?\d{3})$/i;

export function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function isValidBusinessEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidUkPhone(value: string): boolean {
  const cleaned = value.trim();
  if (!cleaned) {
    return false;
  }
  return UK_PHONE_PATTERN.test(cleaned);
}

export function isValidUkPostcode(value: string): boolean {
  const cleaned = value.trim();
  if (!cleaned) {
    return false;
  }
  return UK_POSTCODE_PATTERN.test(cleaned);
}

export function normalizeUkPostcode(value: string): string {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  if (compact.length < 5) {
    return value.trim().toUpperCase();
  }
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function isValidUkVatNumber(value: string): boolean {
  const cleaned = value.trim().replace(/\s+/g, "");
  if (!cleaned) {
    return true;
  }
  return UK_VAT_PATTERN.test(cleaned);
}

export function normalizeUkVatNumber(value: string): string | null {
  const cleaned = value.trim().replace(/\s+/g, "").toUpperCase();
  if (!cleaned) {
    return null;
  }
  if (cleaned.startsWith("GB")) {
    return cleaned;
  }
  return `GB${cleaned}`;
}

/** Optional website: blank OK; otherwise require a real http(s) URL. */
const WEBSITE_PATTERN = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

/** UK Companies House numbers: 8 digits, or SC/NI/OC/SO/R + 6 digits. */
const UK_COMPANY_NUMBER_PATTERN =
  /^(?:\d{8}|[A-Z]{2}\d{6})$/i;

export function isValidBusinessWebsite(value: string): boolean {
  const cleaned = value.trim();
  if (!cleaned) {
    return true;
  }
  return WEBSITE_PATTERN.test(cleaned);
}

/**
 * Normalise optional website. Accepts bare domains (example.co.uk) by
 * prefixing https://. Empty stays empty — never invent a site.
 */
export function normalizeBusinessWebsite(value: string): string | null {
  const cleaned = value.trim();
  if (!cleaned) {
    return null;
  }
  if (/^https?:\/\//i.test(cleaned)) {
    return cleaned;
  }
  return `https://${cleaned}`;
}

export function isValidUkCompanyNumber(value: string): boolean {
  const cleaned = value.trim().replace(/\s+/g, "");
  if (!cleaned) {
    return true;
  }
  return UK_COMPANY_NUMBER_PATTERN.test(cleaned);
}

export function normalizeUkCompanyNumber(value: string): string | null {
  const cleaned = value.trim().replace(/\s+/g, "").toUpperCase();
  return cleaned || null;
}
