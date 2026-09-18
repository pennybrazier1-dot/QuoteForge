import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  afterJobCompletedRedirect,
  COMPLETE_JOB_ERROR,
  COMPLETED_JOBS_PATH,
  formatCompletedDateLong,
  formatCompletedDateShort,
  groupCompletedJobsByMonth,
  HELP_SUPPORT_PATH,
  JOB_COMPLETED_NOTICE,
  jobCompletedNoticeSupport,
  searchCompletedJobs,
  type CompletedJobRecord,
} from "@/lib/jobs/complete-job";
import { buildDateWorkflowSnapshot } from "@/lib/proposals/date-workflow";
import { classifyHomeProposal } from "@/lib/home/home-lifecycle";
import { isAppNavActive } from "@/lib/layout/app-nav";
import { canTransitionStatus } from "@/lib/proposals/status";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function job(
  overrides: Partial<CompletedJobRecord> & Pick<CompletedJobRecord, "id">
): CompletedJobRecord {
  return {
    customer_name: "Emma Collins",
    title: "Bathroom repair",
    job_summary: "Bathroom repair",
    job_address: "12 High Street, SW1A 1AA",
    completed_at: "2026-09-18T10:00:00.000Z",
    status: "completed",
    ...overrides,
  };
}

describe("complete job flow", () => {
  it("saves completed status and timestamp before leaving the job", () => {
    const action = readRepo("app/proposals/lifecycle-actions.ts");
    const completeFn = action.slice(
      action.indexOf("export async function markJobComplete"),
      action.indexOf("export async function reopenCompletedJob")
    );
    expect(completeFn).toContain('status: "completed"');
    expect(completeFn).toContain("completed_at: now");
    expect(completeFn).toContain('updated.status !== "completed"');
    expect(completeFn).toContain("!updated.completed_at");
    expect(completeFn).toContain("COMPLETE_JOB_ERROR");
    expect(completeFn.indexOf("if (")).toBeLessThan(
      completeFn.indexOf("redirect(afterJobCompletedRedirect")
    );
    expect(completeFn).toContain("afterJobCompletedRedirect(proposal.customer_name)");
    expect(completeFn).not.toContain("redirect(`/proposals/${proposalId}`)");
  });

  it("navigates Home with a short success notice after a saved completion", () => {
    expect(afterJobCompletedRedirect("Emma Collins")).toBe(
      "/dashboard?jobCompleted=1&completedCustomer=Emma+Collins"
    );
    expect(JOB_COMPLETED_NOTICE).toBe("Job completed");
    expect(jobCompletedNoticeSupport("Emma Collins")).toBe(
      "Emma Collins has been moved to Completed Jobs."
    );
    const dashboard = readRepo("app/(workspace)/dashboard/page.tsx");
    const home = readRepo("components/home/home-screen.tsx");
    const notice = readRepo("components/home/home-job-completed-notice.tsx");
    expect(dashboard).toContain("jobCompleted={jobCompleted === \"1\"}");
    expect(home).toContain("HomeJobCompletedNotice");
    expect(notice).toContain("JOB_COMPLETED_NOTICE");
    expect(notice).toContain("jobCompletedNoticeSupport");
  });

  it("stays on the job and shows a clear error when the write fails", () => {
    expect(COMPLETE_JOB_ERROR).toBe(
      "Couldn't complete this job. Please try again."
    );
    const action = readRepo("app/proposals/lifecycle-actions.ts");
    const completeFn = action.slice(
      action.indexOf("export async function markJobComplete"),
      action.indexOf("export async function reopenCompletedJob")
    );
    expect(completeFn).toContain("return {\n      error: COMPLETE_JOB_ERROR,");
    expect(completeFn.indexOf("return {\n      error: COMPLETE_JOB_ERROR")).toBeLessThan(
      completeFn.indexOf("redirect(afterJobCompletedRedirect")
    );
  });

  it("does not treat a completed job as current booked work", () => {
    const snapshot = buildDateWorkflowSnapshot({
      status: "completed",
      acceptedAt: "2026-09-01T10:00:00.000Z",
      bookingConfirmation: "confirmed",
      plannedStartDate: "2026-09-18",
      plannedStartTime: "09:00",
    });
    expect(snapshot.isBookedJob).toBe(false);
    expect(snapshot.needsScheduleJob).toBe(false);

    const home = classifyHomeProposal({
      id: "emma",
      status: "completed",
      attention_reason: null,
      booking_confirmation: "confirmed",
      accepted_at: "2026-09-01T10:00:00.000Z",
      planned_start_date_text: null,
      planned_start_date: "2026-09-18",
      planned_start_time: "09:00",
    });
    expect(home.bucket).toBe("none");
  });
});

describe("completed jobs history", () => {
  it("groups newest month first and newest job first inside the month", () => {
    const groups = groupCompletedJobsByMonth([
      job({
        id: "july",
        customer_name: "July Customer",
        completed_at: "2026-07-04T10:00:00.000Z",
      }),
      job({
        id: "aug-late",
        customer_name: "Sarah Jones",
        title: "Kitchen tap replacement",
        completed_at: "2026-08-28T10:00:00.000Z",
      }),
      job({
        id: "sep-early",
        customer_name: "James Wilson",
        title: "Boiler service",
        completed_at: "2026-09-14T10:00:00.000Z",
      }),
      job({
        id: "emma",
        completed_at: "2026-09-18T10:00:00.000Z",
      }),
    ]);

    expect(groups.map((group) => group.heading)).toEqual([
      "September 2026",
      "August 2026",
      "July 2026",
    ]);
    expect(groups[0]?.jobs.map((item) => item.id)).toEqual(["emma", "sep-early"]);
    expect(groups[1]?.jobs[0]?.id).toBe("aug-late");
    expect(formatCompletedDateShort("2026-09-18T10:00:00.000Z")).toBe(
      "Completed 18 Sep"
    );
    expect(formatCompletedDateLong("2026-09-18T10:00:00.000Z")).toBe(
      "Completed 18 September 2026"
    );
  });

  it("searches completed jobs by customer, title, address and postcode", () => {
    const jobs = [
      job({ id: "emma" }),
      job({
        id: "james",
        customer_name: "James Wilson",
        title: "Boiler service",
        job_address: "8 Station Road, M1 1AE",
      }),
    ];

    expect(searchCompletedJobs(jobs, "Emma").map((item) => item.id)).toEqual([
      "emma",
    ]);
    expect(searchCompletedJobs(jobs, "boiler").map((item) => item.id)).toEqual([
      "james",
    ]);
    expect(searchCompletedJobs(jobs, "SW1A").map((item) => item.id)).toEqual([
      "emma",
    ]);
  });

  it("adds Completed Jobs and Help & Support to More without changing bottom nav", () => {
    const more = readRepo("app/(workspace)/more/page.tsx");
    expect(more).toContain("Completed Jobs");
    expect(more).toContain("Help & Support");
    expect(more.indexOf("Visits")).toBeLessThan(more.indexOf("Proposals"));
    expect(more.indexOf("Proposals")).toBeLessThan(more.indexOf("Completed Jobs"));
    expect(more.indexOf("Completed Jobs")).toBeLessThan(more.indexOf("Closed Jobs"));
    expect(more.indexOf("Closed Jobs")).toBeLessThan(
      more.indexOf("Help & Support")
    );
    expect(more.indexOf("Help & Support")).toBeLessThan(more.indexOf("Settings"));
    expect(COMPLETED_JOBS_PATH).toBe("/completed-jobs");
    expect(HELP_SUPPORT_PATH).toBe("/help");

    const nav = readRepo("lib/layout/app-nav.ts");
    expect(nav).toContain('{ href: "/dashboard", label: "Home" }');
    expect(nav).toContain('{ href: "/customers", label: "Customers" }');
    expect(nav).toContain('{ href: "/more", label: "More" }');
    expect(isAppNavActive("/completed-jobs", "/more")).toBe(true);
    expect(isAppNavActive("/help", "/more")).toBe(true);
    expect(isAppNavActive("/dashboard", "/more")).toBe(false);
  });

  it("opens historical details with COMPLETED status and Reopen behind a confirm", () => {
    const workspace = readRepo("components/proposals/proposal-workspace.tsx");
    const actions = readRepo("components/jobs/completed-job-actions.tsx");
    const lifecycle = readRepo("components/proposals/proposal-lifecycle-actions.tsx");
    expect(workspace).toContain("JOB_COMPLETED_STATUS_TITLE");
    expect(workspace).toContain("CompletedJobActions");
    expect(workspace).toContain("formatCompletedDateLong");
    expect(actions).toContain("Reopen this job?");
    expect(actions).toContain("This will move the job back into your active work.");
    expect(actions).toContain("reopenCompletedJob");
    expect(lifecycle).toContain("Mark complete");
    expect(lifecycle).toContain("dateWorkflow.isBookedJob");
    expect(canTransitionStatus("completed", "booked")).toBe(true);
  });

  it("keeps a placeholder Help & Support page without invented contact details", () => {
    const help = readRepo("app/(workspace)/help/page.tsx");
    expect(help).toContain("Help & Support");
    expect(help).not.toMatch(/@/);
    expect(help).not.toMatch(/mailto:/);
    expect(help).not.toMatch(/tel:/);
    expect(help).not.toMatch(/https?:\/\//);
  });
});
