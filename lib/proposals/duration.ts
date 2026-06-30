export function parseEstimatedDuration(
  thingsToConfirm: string | null | undefined
): string {
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
