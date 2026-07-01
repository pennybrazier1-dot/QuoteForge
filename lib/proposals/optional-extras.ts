export function parseOptionalExtrasForStorage(value: string): string[] {
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  return trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatOptionalExtrasForForm(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .join("\n");
}

export function formatOptionalExtrasForDisplay(value: unknown): string | null {
  const formatted = formatOptionalExtrasForForm(value);
  return formatted || null;
}
