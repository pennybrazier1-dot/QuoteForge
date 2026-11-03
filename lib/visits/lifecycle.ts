import type { VisitStatus } from "@/lib/visits/types";

const RESCHEDULABLE: readonly VisitStatus[] = ["scheduled", "confirmed"];
const CANCELLABLE: readonly VisitStatus[] = ["scheduled", "confirmed"];

export function canRescheduleVisit(status: VisitStatus | string): boolean {
  return RESCHEDULABLE.includes(status as VisitStatus);
}

export function canCancelVisit(status: VisitStatus | string): boolean {
  return CANCELLABLE.includes(status as VisitStatus);
}

export function rescheduleBlockedReason(
  status: VisitStatus | string
): string | null {
  if (canRescheduleVisit(status)) {
    return null;
  }
  if (status === "completed") {
    return "Completed visits cannot be rescheduled.";
  }
  if (status === "cancelled") {
    return "Cancelled visits cannot be rescheduled.";
  }
  if (status === "no_show") {
    return "No-show visits cannot be rescheduled.";
  }
  return "This visit cannot be rescheduled.";
}

export function cancelBlockedReason(
  status: VisitStatus | string
): string | null {
  if (canCancelVisit(status)) {
    return null;
  }
  if (status === "completed") {
    return "Completed visits cannot be cancelled.";
  }
  if (status === "cancelled") {
    return "This visit is already cancelled.";
  }
  if (status === "no_show") {
    return "No-show visits cannot be cancelled.";
  }
  return "This visit cannot be cancelled.";
}

export const CUSTOMER_NOT_AUTO_NOTIFIED_NOTICE =
  "Saved. The customer was not emailed automatically — share the confirmation link if they need the update.";
