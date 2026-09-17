import { describe, expect, it } from "vitest";
import { buildHomeSectionGroups } from "@/lib/home/home-data";
import {
  classifyHomeProposal,
  classifyHomeVisit,
  formatHomeSlotLabel,
} from "@/lib/home/home-lifecycle";
import type { HomeProposal } from "@/lib/home/home-data";
import type { VisitRecord } from "@/lib/visits/types";

const now = new Date("2026-08-12T09:00:00.000Z");

function proposal(
  overrides: Partial<HomeProposal> & Pick<HomeProposal, "id" | "status">
): HomeProposal {
  return {
    proposal_number: "QF-001",
    customer_name: "Alex Customer",
    title: "Bathroom refit",
    job_summary: null,
    rough_notes: null,
    scope_of_work: null,
    job_address: "12 High Street",
    attention_reason: null,
    booking_confirmation: null,
    total_amount: 120000,
    created_at: "2026-08-01T10:00:00.000Z",
    updated_at: "2026-08-08T10:00:00.000Z",
    accepted_at: null,
    sent_at: "2026-08-02T10:00:00.000Z",
    booked_at: null,
    completed_at: null,
    planned_start_date_text: null,
    planned_start_date: null,
    planned_start_time: null,
    estimated_duration: "2 days",
    ...overrides,
  };
}

function visit(overrides: Partial<VisitRecord> = {}): VisitRecord {
  return {
    id: "visit-1",
    workspace_id: "ws-1",
    customer_id: "cust-1",
    enquiry_id: null,
    customer_name: "Alex Customer",
    contact_phone: "07700 900123",
    contact_email: "alex@example.com",
    address_line_1: "12 High Street",
    address_line_2: "",
    town: "Leeds",
    county: "",
    postcode: "LS1 1AA",
    enquiry_summary: "Kitchen assessment",
    visit_type: "initial_assessment",
    visit_date: "2026-08-12",
    visit_time: "09:30",
    duration_minutes: 60,
    status: "confirmed",
    notes: "",
    linked_proposal_id: null,
    created_at: "2026-08-08T10:00:00.000Z",
    updated_at: "2026-08-08T10:00:00.000Z",
    ...overrides,
  };
}

function cardsIn(groups: ReturnType<typeof buildHomeSectionGroups>, sectionId: string) {
  return groups.flatMap((group) => group.sections).find((section) => section.id === sectionId)?.cards ?? [];
}

describe("homepage lifecycle buckets", () => {
  it("puts an unresolved date request in Needs attention", () => {
    const item = classifyHomeProposal(
      proposal({
        id: "p-date",
        status: "needs_attention",
        attention_reason: "customer_requested_date_change",
      }),
      now
    );
    expect(item.bucket).toBe("needs_attention");
    expect(item.notes[0]).toMatch(/date change/i);
  });

  it("keeps a Michael Carter confirmed date in Waiting until the proposal is accepted", () => {
    const item = classifyHomeProposal(
      proposal({
        id: "michael-carter",
        status: "waiting_for_customer",
        customer_name: "Michael Carter",
        booking_confirmation: "confirmed",
        planned_start_date: "2026-08-12",
        planned_start_time: "10:30",
        accepted_at: null,
      }),
      now
    );
    expect(item.bucket).toBe("waiting_for_customers");
    expect(item.bucket).not.toBe("booked_job");
    expect(item.notes).toContain("Waiting for proposal acceptance");
  });

  it("moves a confirmed date and unaccepted proposal to Waiting for customers", () => {
    const item = classifyHomeProposal(
      proposal({
        id: "p-wait",
        status: "waiting_for_customer",
        booking_confirmation: "confirmed",
        planned_start_date: "2026-08-12",
        planned_start_time: "10:30",
      }),
      now
    );
    expect(item.bucket).toBe("waiting_for_customers");
    expect(item.notes).toEqual([
      "Date confirmed: 12 August · 10:30",
      "Waiting for proposal acceptance",
    ]);
  });

  it("does not keep a resolved date request in Needs attention", () => {
    const item = classifyHomeProposal(
      proposal({
        id: "p-resolved",
        status: "needs_attention",
        attention_reason: "customer_requested_date_change",
        booking_confirmation: "confirmed",
        planned_start_date: "2026-08-12",
        planned_start_time: "10:30",
      }),
      now
    );
    expect(item.bucket).toBe("waiting_for_customers");
  });

  it("puts an accepted proposal without a date in Jobs to schedule", () => {
    const item = classifyHomeProposal(
      proposal({
        id: "p-schedule",
        status: "booked",
        accepted_at: "2026-08-08T12:00:00.000Z",
      }),
      now
    );
    expect(item.bucket).toBe("jobs_to_schedule");
    expect(item.notes[0]).toBe("Schedule job");
  });

  it("puts accepted plus confirmed date in Booked jobs, or Today's jobs when it is today", () => {
    const booked = classifyHomeProposal(
      proposal({
        id: "p-booked",
        status: "booked",
        accepted_at: "2026-08-08T12:00:00.000Z",
        booking_confirmation: "confirmed",
        planned_start_date: "2026-08-20",
        planned_start_time: "10:30",
      }),
      now
    );
    expect(booked.bucket).toBe("booked_job");

    const today = classifyHomeProposal(
      proposal({
        id: "p-today",
        status: "booked",
        accepted_at: "2026-08-08T12:00:00.000Z",
        booking_confirmation: "confirmed",
        planned_start_date: "2026-08-12",
        planned_start_time: "10:30",
      }),
      now
    );
    expect(today.bucket).toBe("today_job");
  });

  it("moves a customer-confirmed provisional hold to Waiting when the proposal is not accepted", () => {
    const before = classifyHomeProposal(
      proposal({
        id: "p-hold",
        status: "waiting_for_customer",
        booking_confirmation: "provisional",
        planned_start_date: "2026-08-12",
        planned_start_time: "10:30",
      }),
      now
    );
    expect(before.bucket).toBe("waiting_for_customers");

    const after = classifyHomeProposal(
      proposal({
        id: "p-hold",
        status: "waiting_for_customer",
        booking_confirmation: "confirmed",
        planned_start_date: "2026-08-12",
        planned_start_time: "10:30",
      }),
      now
    );
    expect(after.bucket).toBe("waiting_for_customers");
    expect(after.notes[0]).toMatch(/Date confirmed/);
  });

  it("promotes a customer-confirmed hold to a booked job when the proposal is already accepted", () => {
    const item = classifyHomeProposal(
      proposal({
        id: "p-promote",
        status: "booked",
        accepted_at: "2026-08-08T12:00:00.000Z",
        booking_confirmation: "confirmed",
        planned_start_date: "2026-08-20",
        planned_start_time: "10:30",
      }),
      now
    );
    expect(item.bucket).toBe("booked_job");
  });

  it("never places initial visits in Booked jobs", () => {
    const groups = buildHomeSectionGroups(
      [
        proposal({
          id: "p-booked",
          status: "booked",
          accepted_at: "2026-08-08T12:00:00.000Z",
          booking_confirmation: "confirmed",
          planned_start_date: "2026-08-20",
          planned_start_time: "09:00",
        }),
      ],
      [visit({ id: "visit-1", visit_date: "2026-08-20" })],
      now
    );

    const booked = cardsIn(groups, "booked-jobs");
    expect(booked.map((card) => card.id)).toEqual(["p-booked"]);
    expect(booked.some((card) => card.id.startsWith("visit-"))).toBe(false);
  });

  it("leaves follow-up and final inspection out of homepage visit buckets", () => {
    expect(
      classifyHomeVisit(visit({ visit_type: "follow_up", visit_date: "2026-08-12" }), now)
    ).toBe("none");
    expect(
      classifyHomeVisit(
        visit({ visit_type: "final_inspection", visit_date: "2026-08-12" }),
        now
      )
    ).toBe("none");
  });

  it("shows today's initial visit in Today's initial visits", () => {
    expect(classifyHomeVisit(visit({ visit_date: "2026-08-12" }), now)).toBe(
      "today_visit"
    );
    const groups = buildHomeSectionGroups(
      [],
      [visit({ id: "visit-today", visit_date: "2026-08-12" })],
      now
    );
    expect(cardsIn(groups, "todays-initial-visits").map((card) => card.id)).toEqual([
      "visit-visit-today",
    ]);
  });

  it("shows today's booked job in Today's jobs", () => {
    const groups = buildHomeSectionGroups(
      [
        proposal({
          id: "p-today",
          status: "booked",
          accepted_at: "2026-08-08T12:00:00.000Z",
          booking_confirmation: "confirmed",
          planned_start_date: "2026-08-12",
          planned_start_time: "10:30",
        }),
      ],
      [],
      now
    );
    expect(cardsIn(groups, "todays-jobs").map((card) => card.id)).toEqual([
      "p-today",
    ]);
    expect(cardsIn(groups, "booked-jobs")).toHaveLength(0);
  });

  it("keeps Needs attention when another issue remains after the date is resolved", () => {
    const item = classifyHomeProposal(
      proposal({
        id: "p-multi",
        status: "needs_attention",
        attention_reason: "customer_requested_changes",
        booking_confirmation: "confirmed",
        planned_start_date: "2026-08-12",
        planned_start_time: "10:30",
      }),
      now
    );
    expect(item.bucket).toBe("needs_attention");
  });

  it("does not put the same proposal in two homepage buckets", () => {
    const groups = buildHomeSectionGroups(
      [
        proposal({
          id: "p-one",
          status: "booked",
          accepted_at: "2026-08-08T12:00:00.000Z",
          booking_confirmation: "confirmed",
          planned_start_date: "2026-08-12",
          planned_start_time: "10:30",
        }),
      ],
      [],
      now
    );
    const ids = groups
      .flatMap((group) => group.sections)
      .flatMap((section) => section.cards)
      .map((card) => card.id);
    expect(ids.filter((id) => id === "p-one")).toHaveLength(1);
  });

  it("moves items automatically from the saved date and acceptance state", () => {
    expect(
      classifyHomeProposal(
        proposal({
          id: "auto-1",
          status: "waiting_for_customer",
          booking_confirmation: "confirmed",
          planned_start_date: "2026-08-20",
          planned_start_time: "10:30",
        }),
        now
      ).bucket
    ).toBe("waiting_for_customers");
    expect(
      classifyHomeProposal(
        proposal({
          id: "auto-2",
          status: "booked",
          accepted_at: "2026-08-08T12:00:00.000Z",
          booking_confirmation: "confirmed",
          planned_start_date: "2026-08-20",
          planned_start_time: "10:30",
        }),
        now
      ).bucket
    ).toBe("booked_job");
  });

  it("does not invent trader customer-outcome actions on homepage cards", () => {
    const groups = buildHomeSectionGroups(
      [
        proposal({
          id: "p-wait",
          status: "waiting_for_customer",
        }),
      ],
      [],
      now
    );
    const waiting = cardsIn(groups, "waiting-for-customer")[0];
    expect(waiting?.href).toBe("/proposals/p-wait");
    const text = JSON.stringify(waiting);
    expect(text).not.toMatch(/Mark accepted/i);
    expect(text).not.toMatch(/Customer declined/i);
    expect(text).not.toMatch(/Customer requested change/i);
  });

  it("uses the named homepage groups and does not show Confirmed bookings", () => {
    const groups = buildHomeSectionGroups([], [], now);
    expect(groups.map((group) => group.title)).toEqual([
      "Today",
      "Needs action",
      "Waiting",
      "Upcoming",
    ]);
    const titles = groups.flatMap((group) =>
      group.sections.map((section) => section.title)
    );
    expect(titles).toContain("Today's jobs");
    expect(titles).toContain("Today's initial visits");
    expect(titles).toContain("Needs attention");
    expect(titles).toContain("Jobs to schedule");
    expect(titles).toContain("Waiting for customers");
    expect(titles).toContain("Upcoming initial visits");
    expect(titles).toContain("Booked jobs");
    expect(titles.join(" ")).not.toMatch(/Confirmed bookings/i);
    expect(titles.join(" ")).not.toMatch(/Booked bookings/i);
  });

  it("formats the homepage date label without inventing a time", () => {
    expect(
      formatHomeSlotLabel({
        dateIso: "2026-08-12",
        timeHm: "10:30",
      })
    ).toBe("12 August · 10:30");
    expect(formatHomeSlotLabel({ dateIso: "2026-08-12" })).toBe("12 August");
  });
});
