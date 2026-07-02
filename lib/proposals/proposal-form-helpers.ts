import type { GeneratedProposal } from "@/lib/ai";
import { DURATION_CANNOT_DETERMINE_MESSAGE } from "@/lib/ai/prompts";

const DURATION_UNITS = ["day", "days", "hour", "hours", "week", "weeks"] as const;

export type DurationUnit = (typeof DURATION_UNITS)[number];

export function splitDuration(duration: string) {
  const trimmed = duration.trim();

  if (!trimmed) {
    return { value: "", unit: "days" as const };
  }

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s+(.+)$/i);

  if (match) {
    const unit = match[2]!.toLowerCase();

    if (DURATION_UNITS.includes(unit as DurationUnit)) {
      return {
        value: match[1]!,
        unit: unit as DurationUnit,
      };
    }
  }

  return { value: trimmed, unit: "days" as const };
}

export function joinDuration(value: string, unit: DurationUnit): string {
  return [value.trim(), unit].filter(Boolean).join(" ");
}

export function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function arrayToLines(items: string[]): string {
  return items.join("\n");
}

export function applyExtractedProposalFields(proposal: GeneratedProposal) {
  const duration =
    proposal.estimatedDuration.includes(DURATION_CANNOT_DETERMINE_MESSAGE)
      ? { value: "", unit: "days" as const }
      : splitDuration(proposal.estimatedDuration);

  return {
    customerName: proposal.extractedCustomerName.trim(),
    propertyAddress: proposal.extractedPropertyAddress.trim(),
    phoneNumber: proposal.extractedPhoneNumber.trim(),
    emailAddress: proposal.extractedEmailAddress.trim(),
    estimatedPrice: proposal.extractedEstimatedPrice
      .replace(/[£,\s]/g, "")
      .trim(),
    durationValue: duration.value,
    durationUnit: duration.unit,
    optionalExtras: arrayToLines(proposal.optionalExtras),
  };
}

export { DURATION_UNITS };
