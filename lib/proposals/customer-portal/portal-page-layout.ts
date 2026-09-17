import { canShowFinalAccept } from "@/lib/proposals/acceptance-rules";
import {
  resolveCustomerFacingBusinessLogoUrl,
  resolveCustomerFacingBusinessName,
} from "@/lib/proposals/pdf/customer-branding";

export const PORTAL_TOP_LEVEL_ACTIONS = [
  "Accept proposal",
  "Request a change",
  "Ask a question",
  "Decline",
] as const;

export const PORTAL_CHANGE_CHOICES = [
  { id: "date", label: "Date" },
  { id: "time", label: "Time" },
  { id: "job_details", label: "Job details" },
] as const;

export type PortalChangeChoiceId = (typeof PORTAL_CHANGE_CHOICES)[number]["id"];

export type PortalChangeWorkflow = "date" | "time" | "proposal_change";

export function portalPrimaryActionLabel(canAcceptProposal: boolean): string {
  return canAcceptProposal ? "Accept proposal" : "Choose a date";
}

export function portalTopLevelActionLabels(canAcceptProposal: boolean): string[] {
  return [
    portalPrimaryActionLabel(canAcceptProposal),
    "Request a change",
    "Ask a question",
    "Decline",
  ];
}

export function isPortalTopLevelActionSet(labels: string[]): boolean {
  const allowed = new Set<string>([
    "Accept proposal",
    "Choose a date",
    "Request a change",
    "Ask a question",
    "Decline",
  ]);
  return (
    labels.length === 4 &&
    labels.includes("Request a change") &&
    labels.includes("Ask a question") &&
    labels.includes("Decline") &&
    (labels.includes("Accept proposal") || labels.includes("Choose a date")) &&
    !labels.includes("Request different date or time") &&
    !labels.includes("Request different date/time") &&
    labels.every((label) => allowed.has(label))
  );
}

export function getPortalChangeWorkflow(
  choice: PortalChangeChoiceId
): {
  workflow: PortalChangeWorkflow;
  action:
    | "requestAnotherScheduleDate"
    | "requestAnotherScheduleTime"
    | "requestPublicProposalChanges";
} {
  if (choice === "date") {
    return {
      workflow: "date",
      action: "requestAnotherScheduleDate",
    };
  }
  if (choice === "time") {
    return {
      workflow: "time",
      action: "requestAnotherScheduleTime",
    };
  }
  return {
    workflow: "proposal_change",
    action: "requestPublicProposalChanges",
  };
}

export function portalConversationDefaultOpen(
  viewport: "mobile" | "desktop"
): boolean {
  void viewport;
  return false;
}

export function portalTimelineDefaultOpen(
  viewport: "mobile" | "desktop"
): boolean {
  void viewport;
  return false;
}

export function portalSectionDefaultOpen(): boolean {
  return false;
}

export const PORTAL_VISUAL = {
  pageBackground: "#08080a",
  cardBackground: "#1f1f28",
  cardInsetBackground: "#16161e",
  text: "#f5f5f7",
  textMuted: "#a1a1aa",
  accent: "#ff6a1a",
  cardsAreWhite: false,
  orangeIsAccentOnly: true,
} as const;

/** Date-change option cards — presentation only. */
export const PORTAL_DATE_CHANGE_VISUAL = {
  optionBackground: PORTAL_VISUAL.cardInsetBackground,
  optionText: PORTAL_VISUAL.text,
  optionMuted: PORTAL_VISUAL.textMuted,
  selectedBorder: PORTAL_VISUAL.accent,
  fieldBackground: "#0c0c12",
  cardsAreWhite: false,
  mobileMaxWidth: "100%",
  usesPageScroll: true,
  bottomSafeArea: "env(safe-area-inset-bottom, 0px)",
  cardJustify: "flex-start",
  radioWidth: "1.15rem",
  copyMinWidth: "0",
  textStaysInsideCard: true,
  preventsHorizontalOverflow: true,
} as const;

export const PORTAL_AVAILABILITY_COPY = {
  emptyTitle: "No suitable dates are available in this period.",
  emptyAction: "Request another timeframe",
  showMore: "Show more dates",
  initialLimit: 5,
} as const;

export function portalDateChangeCardsAreDark(): boolean {
  return !PORTAL_DATE_CHANGE_VISUAL.cardsAreWhite;
}

export function portalSlotCardCopy(slot: {
  kind: "range" | "appointment";
  label: string;
  startTime?: string;
  workingDays?: number;
}): { title: string; subtitle: string | null } {
  const [title, afterDot] = slot.label.split(" · ");
  if (afterDot?.trim()) {
    return { title: title.trim(), subtitle: afterDot.trim() };
  }
  if (slot.kind === "range") {
    const days = slot.workingDays;
    return {
      title: slot.label,
      subtitle:
        days && days > 1 ? `${days}-day work window` : "Available window",
    };
  }
  if (slot.startTime?.trim()) {
    return { title: slot.label, subtitle: slot.startTime.trim() };
  }
  return { title: slot.label, subtitle: null };
}

export const PORTAL_FORBIDDEN_CUSTOMER_ACTIONS = [
  "Edit",
  "Resend",
  "Send revised proposal",
] as const;

export function shouldShowThingsToConfirm(
  items: Array<string | null | undefined> | null | undefined
): boolean {
  return Boolean(items?.some((item) => item?.trim()));
}

export function portalPreviewText(
  value: string | null | undefined,
  fallback: string,
  max = 96
): string {
  const trimmed = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!trimmed) {
    return fallback;
  }
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function formatPortalIssuedLabel(
  createdAt: string | null | undefined
): string | null {
  if (!createdAt?.trim()) {
    return null;
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatPortalWorkDate(
  dateIso: string | null | undefined,
  dateText?: string | null
): string | null {
  if (dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    const [year, month, day] = dateIso.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, day));
  }
  return dateText?.trim() || null;
}

export function formatPortalWorkTime(
  timeHm: string | null | undefined
): string | null {
  const trimmed = timeHm?.trim() ?? "";
  return /^\d{2}:\d{2}/.test(trimmed) ? trimmed.slice(0, 5) : null;
}

export function resolvePortalJobImageUrl(
  imageUrl: string | null | undefined
): string | null {
  return resolveCustomerFacingBusinessLogoUrl(imageUrl);
}

export function buildCustomerPortalTimelineStages(input: {
  issuedLabel?: string | null;
  status: string;
  isAccepted: boolean;
  isDeclined: boolean;
}): Array<{ id: string; label: string; detail: string | null; current: boolean }> {
  const stages: Array<{
    id: string;
    label: string;
    detail: string | null;
    current: boolean;
  }> = [];

  if (input.issuedLabel) {
    stages.push({
      id: "issued",
      label: "Proposal issued",
      detail: input.issuedLabel,
      current: false,
    });
  }

  if (input.isDeclined) {
    stages.push({
      id: "declined",
      label: "Declined",
      detail: null,
      current: true,
    });
    return stages;
  }

  if (input.isAccepted) {
    stages.push({
      id: "accepted",
      label: "Proposal accepted",
      detail: null,
      current: true,
    });
    return stages;
  }

  if (input.status === "needs_attention") {
    stages.push({
      id: "attention",
      label: "Waiting for an update",
      detail: "The trader is reviewing your message.",
      current: true,
    });
    return stages;
  }

  stages.push({
    id: "waiting",
    label: "Waiting for your response",
    detail: "Review the proposal and choose how to proceed.",
    current: true,
  });
  return stages;
}

export function buildPortalBrandPresentation(input: {
  businessName: string | null | undefined;
  businessLogoUrl?: string | null;
}): {
  heroName: string;
  subtitle: string;
  intro: string;
  logoUrl: string | null;
  showLogo: boolean;
  leadWithReanvil: false;
  productFooter: string;
  securityFooter: string;
} {
  const heroName = resolveCustomerFacingBusinessName(input.businessName);
  const logoUrl = resolveCustomerFacingBusinessLogoUrl(input.businessLogoUrl);
  return {
    heroName,
    subtitle: "Your proposal",
    intro:
      "Thank you for considering us for your project. Here are the details of your proposal.",
    logoUrl,
    showLogo: Boolean(logoUrl),
    leadWithReanvil: false,
    productFooter: "Powered by Reanvil",
    securityFooter: "Secure customer portal",
  };
}

export function buildPortalPageLayout(viewport: "mobile" | "desktop"): {
  conversationDefaultOpen: boolean;
  conversationCollapsible: true;
  timelineDefaultOpen: boolean;
  sectionDefaultOpen: false;
  compactSupportingDetail: boolean;
  stackedActions: boolean;
  responsive: true;
  cardsAreWhite: false;
  pageBackground: string;
  cardBackground: string;
} {
  return {
    conversationDefaultOpen: portalConversationDefaultOpen(viewport),
    conversationCollapsible: true,
    timelineDefaultOpen: portalTimelineDefaultOpen(viewport),
    sectionDefaultOpen: false,
    compactSupportingDetail: viewport === "mobile",
    stackedActions: viewport === "mobile",
    responsive: true,
    cardsAreWhite: false,
    pageBackground: PORTAL_VISUAL.pageBackground,
    cardBackground: PORTAL_VISUAL.cardBackground,
  };
}

/** Presentation only — acceptance rules stay in acceptance-rules.ts. */
export function portalShowsFinalAccept(input: {
  canRespond: boolean;
  plannedStartDate?: string | null;
  plannedStartTime?: string | null;
  estimatedDuration?: string | null;
}): boolean {
  return canShowFinalAccept(input);
}
