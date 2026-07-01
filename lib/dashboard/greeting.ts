export function getTimeGreeting(date = new Date()): string {
  const hour = date.getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function getFirstName(fullName: string | null | undefined): string | null {
  const trimmed = fullName?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.split(/\s+/)[0] ?? null;
}

export function formatDashboardGreeting(fullName: string | null | undefined): string {
  const time = getTimeGreeting();
  const first = getFirstName(fullName);

  if (first) {
    return `${time}, ${first}`;
  }

  return time;
}
