import { TRADER_HOME_PATH } from "@/lib/visits/new-visit";
import { isCompletedJobStatus } from "@/lib/proposals/status";

export { isCompletedJobStatus };

export const JOB_COMPLETED_NOTICE = "Job completed";
export const JOB_COMPLETED_NOTICE_PARAM = "jobCompleted";
export const JOB_COMPLETED_CUSTOMER_PARAM = "completedCustomer";
export const COMPLETE_JOB_ERROR = "Couldn't complete this job. Please try again.";
export const REOPEN_JOB_ERROR = "Couldn't reopen this job. Please try again.";
export const COMPLETED_JOBS_PATH = "/completed-jobs";
export const CLOSED_JOBS_PATH = "/closed-jobs";
export const HELP_SUPPORT_PATH = "/help";
export const JOB_COMPLETED_STATUS_TITLE = "COMPLETED";
export const COMPLETED_JOB_LIST_STATUSES = [
  "completed",
  "invoiced",
  "paid",
] as const;

export type CompletedJobRecord = {
  id: string;
  customer_name: string | null;
  title: string;
  job_summary?: string | null;
  job_address?: string | null;
  completed_at: string | null;
  status: string;
  payment_status?: string | null;
  closed_at?: string | null;
};

export type CompletedJobMonthGroup = {
  key: string;
  heading: string;
  jobs: CompletedJobRecord[];
};

export function afterJobCompletedRedirect(customerName?: string | null): string {
  const params = new URLSearchParams({
    [JOB_COMPLETED_NOTICE_PARAM]: "1",
  });
  const name = customerName?.trim();
  if (name) {
    params.set(JOB_COMPLETED_CUSTOMER_PARAM, name);
  }
  return `${TRADER_HOME_PATH}?${params.toString()}`;
}

export function jobCompletedNoticeSupport(customerName?: string | null): string | null {
  const name = customerName?.trim();
  return name ? `${name} has been moved to Completed Jobs.` : null;
}

export function formatCompletedMonthHeading(value: string | null | undefined): string {
  const date = parseCompletedDate(value);
  if (!date) {
    return "Completed";
  }
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatCompletedDateShort(value: string | null | undefined): string {
  const date = parseCompletedDate(value);
  if (!date) {
    return "Completed";
  }
  return `Completed ${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
}

export function formatCompletedDateLong(value: string | null | undefined): string {
  const date = parseCompletedDate(value);
  if (!date) {
    return "Completed";
  }
  return `Completed ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)}`;
}

export function completedJobSearchHaystack(job: CompletedJobRecord): string {
  return [
    job.customer_name,
    job.title,
    job.job_summary,
    job.job_address,
  ]
    .map((part) => part?.toLowerCase().trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

export function searchCompletedJobs(
  jobs: CompletedJobRecord[],
  query: string
): CompletedJobRecord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return jobs;
  }
  return jobs.filter((job) => completedJobSearchHaystack(job).includes(needle));
}

export function groupCompletedJobsByMonth(
  jobs: CompletedJobRecord[]
): CompletedJobMonthGroup[] {
  const sorted = [...jobs].sort((left, right) => {
    const leftTime = parseCompletedDate(left.completed_at)?.getTime() ?? 0;
    const rightTime = parseCompletedDate(right.completed_at)?.getTime() ?? 0;
    return rightTime - leftTime;
  });

  const groups = new Map<string, CompletedJobMonthGroup>();
  for (const job of sorted) {
    const date = parseCompletedDate(job.completed_at);
    const key = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : "unknown";
    const existing = groups.get(key);
    if (existing) {
      existing.jobs.push(job);
      continue;
    }
    groups.set(key, {
      key,
      heading: formatCompletedMonthHeading(job.completed_at),
      jobs: [job],
    });
  }

  return [...groups.values()];
}

function parseCompletedDate(value: string | null | undefined): Date | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}
