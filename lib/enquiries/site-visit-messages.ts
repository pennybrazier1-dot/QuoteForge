import { toIsoDate } from "@/lib/calendar/calendar-data";

export type SiteVisitTimeSlot = {
  id: string;
  label: string;
  confirmationLine: string;
};

export const SITE_VISIT_TIME_SLOTS: SiteVisitTimeSlot[] = [
  {
    id: "tomorrow-10",
    label: "Tomorrow 10:00",
    confirmationLine: "tomorrow at 10:00",
  },
  {
    id: "tomorrow-14",
    label: "Tomorrow 14:00",
    confirmationLine: "tomorrow at 14:00",
  },
  {
    id: "thursday-0930",
    label: "Thursday 09:30",
    confirmationLine: "Thursday at 9:30",
  },
  {
    id: "friday-1300",
    label: "Friday 13:00",
    confirmationLine: "Friday at 13:00",
  },
];

export function getCustomerFirstName(customerName: string): string {
  const trimmed = customerName.trim();
  if (!trimmed) {
    return "there";
  }

  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function buildSiteVisitOutreachMessage(customerName: string): string {
  const firstName = getCustomerFirstName(customerName);

  return `Hi ${firstName}, thanks for your enquiry. I'd like to arrange a site visit so I can take a look, discuss the work, and prepare an accurate quote. Would any of these times work for you?`;
}

export function buildSiteVisitConfirmationMessage(
  customerName: string,
  businessName: string,
  confirmationLine: string
): string {
  const firstName = getCustomerFirstName(customerName);
  const business = businessName.trim() || "us";

  return `Hi ${firstName}, your site visit with ${business} is booked for ${confirmationLine}. Please make sure the work area is accessible.`;
}

export function buildSiteVisitEmailSubject(businessName: string): string {
  const business = businessName.trim() || "QuoteForge";
  return `Site visit for your enquiry — ${business}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nextWeekday(from: Date, weekday: number): Date {
  const next = new Date(from);
  const diff = (weekday - next.getDay() + 7) % 7 || 7;
  next.setDate(next.getDate() + diff);
  return next;
}

export function resolveSiteVisitSlotDateTime(
  slotId: string,
  now = new Date()
): {
  dateIso: string;
  startsAt: string;
  confirmationLine: string;
  slotLabel: string;
} | null {
  const slot = SITE_VISIT_TIME_SLOTS.find((entry) => entry.id === slotId);

  if (!slot) {
    return null;
  }

  let date: Date;

  switch (slotId) {
    case "tomorrow-10":
      date = addDays(now, 1);
      date.setHours(10, 0, 0, 0);
      break;
    case "tomorrow-14":
      date = addDays(now, 1);
      date.setHours(14, 0, 0, 0);
      break;
    case "thursday-0930":
      date = nextWeekday(now, 4);
      date.setHours(9, 30, 0, 0);
      break;
    case "friday-1300":
      date = nextWeekday(now, 5);
      date.setHours(13, 0, 0, 0);
      break;
    default:
      return null;
  }

  return {
    dateIso: toIsoDate(date),
    startsAt: date.toISOString(),
    confirmationLine: slot.confirmationLine,
    slotLabel: slot.label,
  };
}
