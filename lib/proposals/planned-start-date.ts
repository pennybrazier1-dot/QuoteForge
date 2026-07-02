/** Shown in Things to Confirm when the planned start is vague or unconfirmed. */
export const CONFIRM_PLANNED_START_DATE =
  "Confirm planned start date";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateString(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function normalizePlannedStartExact(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed && isIsoDateString(trimmed) ? trimmed : null;
}

export function formatPlannedStartExact(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export type PlannedStartDateFields = {
  plannedStartDate: string;
  plannedStartDateExact: string;
};

export function plannedStartFromDb(row: {
  planned_start_date_text?: string | null;
  planned_start_date?: string | null;
}): PlannedStartDateFields {
  const exact = normalizePlannedStartExact(row.planned_start_date) ?? "";
  const text = row.planned_start_date_text?.trim() ?? "";

  if (text) {
    return { plannedStartDate: text, plannedStartDateExact: exact };
  }

  if (exact) {
    return {
      plannedStartDate: formatPlannedStartExact(exact),
      plannedStartDateExact: exact,
    };
  }

  return { plannedStartDate: "", plannedStartDateExact: "" };
}

export function plannedStartToDbFields(fields: PlannedStartDateFields) {
  const text = fields.plannedStartDate.trim();
  const exact = normalizePlannedStartExact(fields.plannedStartDateExact);

  return {
    planned_start_date_text: text || null,
    planned_start_date: exact,
  };
}
