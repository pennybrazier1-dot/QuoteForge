export function startOfDayIso(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
