import {
  formatPlannedStartExact,
  normalizePlannedStartExact,
} from "@/lib/proposals/planned-start-date";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizePlannedStartTime(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  return TIME_PATTERN.test(trimmed) ? trimmed : null;
}

export function formatPlannedStartTimeLabel(
  time: string | null | undefined
): string | null {
  const normalized = normalizePlannedStartTime(time);
  if (!normalized) {
    return null;
  }

  const [hourRaw, minute] = normalized.split(":");
  const hour = Number(hourRaw);
  const suffix = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute}${suffix}`;
}

export function buildScheduleDateLabel(input: {
  dateIso: string | null;
  time: string | null;
  fallbackText?: string | null;
}): string {
  const exact = normalizePlannedStartExact(input.dateIso);
  if (!exact) {
    return input.fallbackText?.trim() || "";
  }

  const dateLabel = formatPlannedStartExact(exact);
  const timeLabel = formatPlannedStartTimeLabel(input.time);
  return timeLabel ? `${dateLabel} at ${timeLabel}` : dateLabel;
}

export function buildScheduleWorkspacePath(
  proposalId: string,
  hints?: {
    suggestedDateText?: string | null;
    suggestedDateExact?: string | null;
  }
): string {
  const params = new URLSearchParams();
  if (hints?.suggestedDateText?.trim()) {
    params.set("suggestedDate", hints.suggestedDateText.trim());
  }
  if (hints?.suggestedDateExact?.trim()) {
    params.set("suggestedDateExact", hints.suggestedDateExact.trim());
  }
  const query = params.toString();
  return query
    ? `/proposals/${proposalId}/schedule?${query}`
    : `/proposals/${proposalId}/schedule`;
}
