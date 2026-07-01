export function parseEstimatedDuration(
  estimatedDuration: string | null | undefined,
  thingsToConfirm?: string | null
): string {
  if (estimatedDuration?.trim()) {
    return estimatedDuration.trim();
  }

  if (!thingsToConfirm) {
    return "";
  }

  const prefix = "Estimated duration: ";
  if (thingsToConfirm.startsWith(prefix)) {
    return thingsToConfirm.slice(prefix.length).trim();
  }

  return "";
}

export function buildEstimatedDurationNote(duration: string): string | null {
  const trimmed = duration.trim();
  return trimmed ? `Estimated duration: ${trimmed}` : null;
}
