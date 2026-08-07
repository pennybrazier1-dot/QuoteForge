export const JOB_STATUSES = [
  "accepted",
  "preparing",
  "scheduled",
  "in_progress",
  "completed",
  "invoiced",
  "paid",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

export function formatJobStatus(status: string): string {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "preparing":
      return "Preparing";
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "invoiced":
      return "Invoiced";
    case "paid":
      return "Paid";
    default:
      return status;
  }
}

/** Trader banner while the job still needs prep before scheduling. */
export function needsJobPreparation(status: string): boolean {
  return status === "accepted" || status === "preparing";
}
