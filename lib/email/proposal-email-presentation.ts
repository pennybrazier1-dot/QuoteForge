import {
  PLACEHOLDER_BUSINESS_NAMES,
  PROPOSAL_EMAIL_SUBJECT_FALLBACK,
} from "@/lib/email/proposal-email-tokens";
import {
  isNonCustomerFacingBusinessName,
  resolveCustomerFacingBusinessName,
} from "@/lib/proposals/pdf/customer-branding";

const FORBIDDEN_OUTPUT = /^(null|undefined|n\/a|na|none|unknown)$/i;
const GENERIC_TITLE = /^proposal(\s+for\b.*)?$/i;
const GENERIC_GREETING = /^(customer|there|client)$/i;

export function isPlaceholderBusinessName(
  value: string | null | undefined
): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return true;
  }
  return PLACEHOLDER_BUSINESS_NAMES.some(
    (placeholder) => placeholder.toLowerCase() === trimmed.toLowerCase()
  );
}

/** Never returns "Your Business". Missing/admin names become null. */
export function resolveProposalEmailBusinessName(
  businessName: string | null | undefined
): string | null {
  const trimmed = businessName?.trim() ?? "";
  if (!trimmed || isNonCustomerFacingBusinessName(trimmed)) {
    return null;
  }
  const resolved = resolveCustomerFacingBusinessName(trimmed);
  if (isPlaceholderBusinessName(resolved)) {
    return null;
  }
  return resolved;
}

export function buildProposalEmailSubject(
  businessName: string | null | undefined
): string {
  const business = resolveProposalEmailBusinessName(businessName);
  return business ? `Proposal from ${business}` : PROPOSAL_EMAIL_SUBJECT_FALLBACK;
}

export function sanitizeProposalEmailSubject(
  subject: string | null | undefined,
  businessName: string | null | undefined
): string {
  const trimmed = subject?.trim() ?? "";
  if (!trimmed || /from\s+your\s+business\b/i.test(trimmed)) {
    return buildProposalEmailSubject(businessName);
  }
  return trimmed;
}

export function proposalEmailFirstName(
  fullName: string | null | undefined
): string | null {
  const first = fullName?.trim().split(/\s+/)[0] ?? "";
  if (!first || GENERIC_GREETING.test(first) || FORBIDDEN_OUTPUT.test(first)) {
    return null;
  }
  return first;
}

export function isUsableEmailValue(
  value: string | null | undefined
): value is string {
  const trimmed = value?.trim() ?? "";
  return Boolean(trimmed) && !FORBIDDEN_OUTPUT.test(trimmed);
}

export function formatProposalEmailTime(
  timeHm: string | null | undefined
): string | null {
  const trimmed = timeHm?.trim() ?? "";
  if (!trimmed || FORBIDDEN_OUTPUT.test(trimmed)) {
    return null;
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return trimmed;
  }
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function formatProposalEmailDateTime(input: {
  dateIso?: string | null;
  dateText?: string | null;
  timeHm?: string | null;
}): string | null {
  const iso = input.dateIso?.trim() ?? "";
  let datePart = "";

  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (
      !Number.isNaN(date.getTime()) &&
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      try {
        datePart = new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(date);
      } catch {
        datePart = "";
      }
    }
  } else if (isUsableEmailValue(input.dateText)) {
    datePart = input.dateText.trim();
  }

  if (!datePart) {
    return null;
  }

  const time = formatProposalEmailTime(input.timeHm);
  return time ? `${datePart} at ${time}` : datePart;
}

export function formatProposalEmailDuration(
  duration: string | null | undefined
): string | null {
  const trimmed = duration?.trim() ?? "";
  if (
    !trimmed ||
    FORBIDDEN_OUTPUT.test(trimmed) ||
    /^not specified$/i.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

export function formatProposalEmailSummary(
  summary: string | null | undefined
): string | null {
  if (!isUsableEmailValue(summary)) {
    return null;
  }

  const lines = summary
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (lines.length === 0) {
    return null;
  }

  let text = lines.join(" ");
  if (text.length > 280) {
    const clipped = text.slice(0, 277).replace(/\s+\S*$/, "");
    text = `${clipped}…`;
  }
  return text;
}

const MAX_TITLE_CHARS = 48;
const MAX_TITLE_WORDS = 6;

function titleCaseJob(value: string): string {
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return value;
  }
  const [first, ...rest] = words;
  return [
    first.charAt(0).toUpperCase() + first.slice(1).toLowerCase(),
    ...rest.map((word) => word.toLowerCase()),
  ].join(" ");
}

export function isLongProposalScope(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return false;
  }
  return (
    trimmed.length > MAX_TITLE_CHARS ||
    trimmed.split(/\s+/).length > MAX_TITLE_WORDS ||
    /\bincluding\b/i.test(trimmed)
  );
}

export function isConciseProposalJobTitle(
  value: string | null | undefined
): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || GENERIC_TITLE.test(trimmed) || FORBIDDEN_OUTPUT.test(trimmed)) {
    return false;
  }
  return !isLongProposalScope(trimmed);
}

export function shortenScopeToJobTitle(
  summary: string | null | undefined
): string | null {
  const trimmed = summary?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? "";
  if (isConciseProposalJobTitle(firstLine)) {
    return firstLine;
  }
  const beforeIncluding = firstLine.split(/\bincluding\b/i)[0]?.trim() ?? "";
  const withoutFull = beforeIncluding.replace(/^full\s+/i, "").trim();
  if (isConciseProposalJobTitle(withoutFull)) {
    return titleCaseJob(withoutFull);
  }
  return null;
}

export function resolveProposalEmailJobTitle(input: {
  title?: string | null;
  jobSummary?: string | null;
  proposalNumber?: string | null;
}): string {
  const storedTitle = input.title?.trim() ?? "";
  if (isConciseProposalJobTitle(storedTitle)) {
    return storedTitle;
  }

  const fromSummary = shortenScopeToJobTitle(input.jobSummary);
  if (fromSummary) {
    return fromSummary;
  }

  return "Your proposal";
}

export function resolveProposalEmailJobSubtitle(input: {
  jobTitle: string;
  jobSummary?: string | null;
}): string | null {
  const lines = (input.jobSummary ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate = lines[1];
  if (
    !candidate ||
    candidate === input.jobTitle ||
    isLongProposalScope(candidate) ||
    FORBIDDEN_OUTPUT.test(candidate)
  ) {
    return null;
  }
  return candidate;
}

export function sameEmailCopy(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const a = left?.trim().toLowerCase() ?? "";
  const b = right?.trim().toLowerCase() ?? "";
  return Boolean(a && b && a === b);
}

export function proposalEmailProjectPhrase(jobTitle: string): string {
  const trimmed = jobTitle.trim();
  if (!trimmed || /^your proposal$/i.test(trimmed) || isLongProposalScope(trimmed)) {
    return "your project";
  }
  const lower = trimmed.toLowerCase();
  return /project|installation|refit|renovation|replacement|work|job/i.test(lower)
    ? lower
    : `${lower} project`;
}

export function buildProposalEmailGreeting(
  firstName: string | null
): string {
  return firstName ? `Hi ${firstName},` : "Hi,";
}

export function buildProposalEmailIntro(jobTitle: string): string {
  return `Your proposal for the ${proposalEmailProjectPhrase(jobTitle)} is ready to view in your secure customer portal.`;
}

export function htmlProminentlyShowsPortalUrl(html: string): boolean {
  return />\s*https?:\/\/[^<]*\/p\/[A-Za-z0-9_-]+/i.test(html);
}

export function emailHtmlHasDarkTextOnDarkBackground(html: string): boolean {
  return /color\s*:\s*#(?:111113|111827|000000|0a0a0a|171717)\b/i.test(html);
}

export function emailHtmlUsesCssVariables(html: string): boolean {
  return /var\(--/.test(html);
}

export function buildProposalEmailContentFields(proposal: {
  title?: string | null;
  job_summary?: string | null;
  proposal_number?: string | null;
  total_amount?: number | null;
  planned_start_date?: string | null;
  planned_start_date_text?: string | null;
  planned_start_time?: string | null;
  estimated_duration?: string | null;
  customer_name?: string | null;
}): {
  title: string;
  jobSubtitle: string | null;
  proposedDateLabel: string | null;
  durationLabel: string | null;
  scopeSummary: string | null;
  customerFirstName: string | null;
} {
  const title = resolveProposalEmailJobTitle({
    title: proposal.title,
    jobSummary: proposal.job_summary,
    proposalNumber: proposal.proposal_number,
  });
  const subtitle = resolveProposalEmailJobSubtitle({
    jobTitle: title,
    jobSummary: proposal.job_summary,
  });
  const scopeSummary = formatProposalEmailSummary(proposal.job_summary);
  return {
    title,
    jobSubtitle:
      subtitle && !sameEmailCopy(subtitle, title) ? subtitle : null,
    proposedDateLabel: formatProposalEmailDateTime({
      dateIso: proposal.planned_start_date,
      dateText: proposal.planned_start_date_text,
      timeHm: proposal.planned_start_time,
    }),
    durationLabel: formatProposalEmailDuration(proposal.estimated_duration),
    scopeSummary:
      scopeSummary && !sameEmailCopy(scopeSummary, title) ? scopeSummary : null,
    customerFirstName: proposalEmailFirstName(proposal.customer_name),
  };
}

export function resolveProposalEmailTradeLabel(
  tradeType: string | null | undefined,
  businessName: string | null | undefined
): string | null {
  const trade = tradeType?.trim() ?? "";
  if (!trade || FORBIDDEN_OUTPUT.test(trade)) {
    return null;
  }
  const business = businessName?.trim().toLowerCase() ?? "";
  if (business && business.includes(trade.toLowerCase())) {
    return null;
  }
  return trade;
}
