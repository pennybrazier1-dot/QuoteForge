import { describe, expect, it } from "vitest";
import { buildLocalSiteVisitJobs, mergeCalendarJobs } from "@/lib/calendar/local-calendar-data";
import type { CalendarJob } from "@/lib/calendar/calendar-data";

describe("local calendar site visit jobs", () => {
  it("builds calendar jobs from local site visit events", () => {
    const jobs = buildLocalSiteVisitJobs([
      {
        id: "site-visit-enquiry-1",
        kind: "site_visit",
        enquiryId: "enquiry-1",
        title: "Site visit — Sarah Thompson",
        customerName: "Sarah Thompson",
        address: "12 Oak Avenue, Northampton, NN1 1AA",
        startsAt: "2026-07-10T09:30:00.000Z",
        dateIso: "2026-07-10",
        slotLabel: "Thursday 09:30",
        status: "site_visit_booked",
        createdAt: "2026-07-09T12:00:00.000Z",
      },
    ]);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: "Site visit — Sarah Thompson",
      customer: "Sarah Thompson",
      tone: "site_visit",
      badgeLabel: "Site Visit Booked",
      href: "/enquiries/enquiry-1",
      startDate: "2026-07-10",
    });
  });

  it("merges local site visit jobs with proposal jobs", () => {
    const proposalJob: CalendarJob = {
      id: "proposal-1",
      proposalId: "proposal-1",
      href: "/proposals/proposal-1",
      title: "Kitchen refit",
      customer: "Alex Jones",
      startDate: "2026-07-11",
      endDate: "2026-07-11",
      spanDates: ["2026-07-11"],
      dateLabel: "11 Jul",
      tone: "confirmed",
    };

    const merged = mergeCalendarJobs(
      [proposalJob],
      buildLocalSiteVisitJobs([
        {
          id: "site-visit-enquiry-1",
          kind: "site_visit",
          enquiryId: "enquiry-1",
          title: "Site visit — Sarah Thompson",
          customerName: "Sarah Thompson",
          address: "12 Oak Avenue",
          startsAt: "2026-07-10T09:30:00.000Z",
          dateIso: "2026-07-10",
          slotLabel: "Thursday 09:30",
          status: "site_visit_booked",
          createdAt: "2026-07-09T12:00:00.000Z",
        },
      ])
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]?.startDate).toBe("2026-07-10");
    expect(merged[1]?.startDate).toBe("2026-07-11");
  });
});
