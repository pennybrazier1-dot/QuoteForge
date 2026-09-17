import { describe, expect, it } from "vitest";
import {
  buildCustomerActivityItems,
  CUSTOMER_DETAIL_SECTIONS,
  customerCurrentWorkMeta,
  customerCurrentWorkTitle,
  customerDetailSectionDefaultOpen,
  LAST_MINUTE_CANCELLATION_SUPPORTED,
  splitCustomerJobs,
  splitCustomerVisits,
} from "@/lib/customers/detail-model";

describe("customer detail hierarchy", () => {
  it("keeps contact, jobs, proposals, visits, and activity sections", () => {
    expect(CUSTOMER_DETAIL_SECTIONS.map((section) => section.id)).toEqual([
      "details",
      "current_work",
      "job_history",
      "proposals",
      "visits",
      "activity",
    ]);
    expect(customerDetailSectionDefaultOpen("details")).toBe(true);
    expect(customerDetailSectionDefaultOpen("current_work")).toBe(true);
    expect(customerDetailSectionDefaultOpen("job_history")).toBe(false);
    expect(customerDetailSectionDefaultOpen("activity")).toBe(false);
  });

  it("splits current jobs from completed job history", () => {
    const split = splitCustomerJobs([
      {
        id: "job-now",
        status: "scheduled",
        accepted_at: "2026-09-01T00:00:00.000Z",
        proposal_id: "p1",
      },
      {
        id: "job-old",
        status: "completed",
        accepted_at: "2026-08-01T00:00:00.000Z",
        completed_at: "2026-08-20T00:00:00.000Z",
        proposal_id: "p2",
      },
    ]);
    expect(split.current.map((job) => job.id)).toEqual(["job-now"]);
    expect(split.history.map((job) => job.id)).toEqual(["job-old"]);
  });

  it("shows the booked job title and confirmed date on current work", () => {
    expect(
      customerCurrentWorkTitle({
        id: "job-now",
        status: "scheduled",
        accepted_at: "2026-08-01T00:00:00.000Z",
        proposal_id: "p1",
        title: "Block-pave driveway",
        plannedStartDate: "2026-08-12",
        plannedStartTime: "10:30",
        bookingConfirmation: "confirmed",
      })
    ).toBe("Block-pave driveway");
    expect(
      customerCurrentWorkMeta({
        id: "job-now",
        status: "scheduled",
        accepted_at: "2026-08-01T00:00:00.000Z",
        proposal_id: "p1",
        title: "Block-pave driveway",
        plannedStartDate: "2026-08-12",
        plannedStartTime: "10:30",
        bookingConfirmation: "confirmed",
      })
    ).toBe("12 August · 10:30 · Booked");
  });

  it("keeps cancelled visits in history without inventing last-minute cancellations", () => {
    const split = splitCustomerVisits([
      {
        id: "visit-1",
        visit_date: "2026-09-18",
        visit_time: "10:30",
        status: "scheduled",
        visit_type: "initial_assessment",
      },
      {
        id: "visit-2",
        visit_date: "2026-09-10",
        visit_time: "09:00",
        status: "cancelled",
        visit_type: "follow_up",
      },
    ]);
    expect(split.current).toHaveLength(1);
    expect(split.history[0]?.status).toBe("cancelled");
    expect(LAST_MINUTE_CANCELLATION_SUPPORTED).toBe(false);
  });

  it("surfaces stored declined, cancelled, and date-change events only", () => {
    const items = buildCustomerActivityItems([
      {
        id: "e1",
        proposalId: "p1",
        eventType: "status_change",
        toStatus: "declined",
        note: "Customer declined",
        createdAt: "2026-09-10T10:00:00.000Z",
      },
      {
        id: "e2",
        proposalId: "p1",
        eventType: "rearranged",
        toStatus: null,
        note: "Date changed to 24 Sep",
        createdAt: "2026-09-11T10:00:00.000Z",
      },
      {
        id: "e3",
        proposalId: "p1",
        eventType: "viewed",
        toStatus: null,
        note: null,
        createdAt: "2026-09-09T10:00:00.000Z",
      },
    ]);
    expect(items.map((item) => item.id)).toEqual(["e2", "e1"]);
    expect(items.some((item) => /last-minute/i.test(item.label))).toBe(false);
  });
});
