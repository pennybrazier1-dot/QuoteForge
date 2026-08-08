export const VISIT_TYPES = [
  "initial_assessment",
  "measure_up",
  "follow_up",
  "final_inspection",
] as const;

export type VisitType = (typeof VISIT_TYPES)[number];

export const VISIT_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type VisitStatus = (typeof VISIT_STATUSES)[number];

export type VisitRecord = {
  id: string;
  workspace_id: string;
  customer_id: string | null;
  enquiry_id: string | null;
  customer_name: string;
  contact_phone: string;
  contact_email: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  county: string;
  postcode: string;
  enquiry_summary: string;
  visit_type: VisitType;
  visit_date: string;
  visit_time: string | null;
  duration_minutes: number;
  status: VisitStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

export const VISIT_SELECT =
  "id, workspace_id, customer_id, enquiry_id, customer_name, contact_phone, contact_email, address_line_1, address_line_2, town, county, postcode, enquiry_summary, visit_type, visit_date, visit_time, duration_minutes, status, notes, created_at, updated_at";

export function isVisitType(value: string): value is VisitType {
  return (VISIT_TYPES as readonly string[]).includes(value);
}

export function isVisitStatus(value: string): value is VisitStatus {
  return (VISIT_STATUSES as readonly string[]).includes(value);
}

export function formatVisitType(type: string): string {
  switch (type) {
    case "initial_assessment":
      return "Initial assessment";
    case "measure_up":
      return "Measure up";
    case "follow_up":
      return "Follow-up visit";
    case "final_inspection":
      return "Final inspection";
    default:
      return type;
  }
}

export function formatVisitStatus(status: string): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "confirmed":
      return "Confirmed";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "no_show":
      return "No show";
    default:
      return status;
  }
}

export function formatVisitDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const wholeHours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${wholeHours}h ${mins}m`;
}

export function formatVisitTimeLabel(time: string | null | undefined): string | null {
  const trimmed = time?.trim() ?? "";
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    return null;
  }
  const [hourRaw, minute] = trimmed.split(":");
  const hour = Number(hourRaw);
  const suffix = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute}${suffix}`;
}

export function formatVisitDateLabel(dateIso: string): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function formatVisitAddress(visit: Pick<
  VisitRecord,
  "address_line_1" | "address_line_2" | "town" | "county" | "postcode"
>): string {
  return [
    visit.address_line_1,
    visit.address_line_2,
    visit.town,
    visit.county,
    visit.postcode,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export const VISIT_DURATION_OPTIONS = [
  { minutes: 30, label: "30 minutes" },
  { minutes: 45, label: "45 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "1.5 hours" },
  { minutes: 120, label: "2 hours" },
] as const;

export const VISIT_TIME_OPTIONS = [
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
] as const;
