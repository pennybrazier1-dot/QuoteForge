export function startOfDayIso(date = new Date()): string {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.toISOString().slice(0, 10);
}

export function isPlannedStartToday(
  plannedStartDate: string | null,
  reference = new Date()
): boolean {
  if (!plannedStartDate) {
    return false;
  }

  return plannedStartDate.slice(0, 10) === startOfDayIso(reference);
}

export function isPlannedStartInFuture(
  plannedStartDate: string | null,
  reference = new Date()
): boolean {
  if (!plannedStartDate) {
    return false;
  }

  return plannedStartDate.slice(0, 10) > startOfDayIso(reference);
}
