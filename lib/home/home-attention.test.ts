import { describe, expect, it } from "vitest";
import {
  buildHomeSectionGroups,
  type HomeProposal,
} from "@/lib/home/home-data";
import {
  HOME_ATTENTION_EMPTY,
  attentionItemHref,
  buildHomeAttentionItems,
  getHomeAttentionCount,
  isHomeAttentionBucket,
} from "@/lib/home/home-attention";
import { classifyHomeProposal } from "@/lib/home/home-lifecycle";

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

function needsActionCardIds(proposals: HomeProposal[]) {
  return buildHomeSectionGroups(proposals, [], now)
    .find((group) => group.id === "needs-action")
    ?.sections.flatMap((section) => section.cards.map((card) => card.id));
}

describe("trader attention bell", () => {
  it("matches the actionable Home Needs action buckets", () => {
    const proposals = [
      proposal({
        id: "wait",
        status: "waiting_for_customer",
        customer_name: "Waiting Person",
      }),
      proposal({
        id: "booked",
        status: "booked",
        customer_name: "Booked Person",
        accepted_at: "2026-08-08T12:00:00.000Z",
        booking_confirmation: "confirmed",
        planned_start_date: "2026-08-20",
        planned_start_time: "10:30",
      }),
      proposal({
        id: "question",
        status: "needs_attention",
        attention_reason: "customer_question",
        customer_name: "Question Person",
      }),
      proposal({
        id: "draft",
        status: "draft",
        customer_name: "Draft Person",
      }),
    ];

    const items = buildHomeAttentionItems(proposals, now);
    const homeIds = needsActionCardIds(proposals) ?? [];

    expect(items.map((item) => item.id).sort()).toEqual([...homeIds].sort());
    expect(getHomeAttentionCount(proposals, now)).toBe(homeIds.length);
    expect(items.map((item) => item.id)).not.toContain("wait");
    expect(items.map((item) => item.id)).not.toContain("booked");
  });

  it("does not count Waiting for Customer", () => {
    const waiting = proposal({
      id: "michael-wait",
      status: "waiting_for_customer",
      customer_name: "Michael Carter",
      booking_confirmation: "confirmed",
      planned_start_date: "2026-08-12",
      planned_start_time: "10:30",
    });
    expect(classifyHomeProposal(waiting, now).bucket).toBe(
      "waiting_for_customers"
    );
    expect(isHomeAttentionBucket(classifyHomeProposal(waiting, now).bucket)).toBe(
      false
    );
    expect(getHomeAttentionCount([waiting], now)).toBe(0);
  });

  it("does not count booked jobs", () => {
    const booked = proposal({
      id: "booked-job",
      status: "booked",
      accepted_at: "2026-08-08T12:00:00.000Z",
      booking_confirmation: "confirmed",
      planned_start_date: "2026-08-20",
      planned_start_time: "10:30",
    });
    expect(classifyHomeProposal(booked, now).bucket).toBe("booked_job");
    expect(getHomeAttentionCount([booked], now)).toBe(0);
  });

  it("counts a customer question", () => {
    const items = buildHomeAttentionItems(
      [
        proposal({
          id: "q1",
          status: "needs_attention",
          attention_reason: "customer_question",
          customer_name: "Sarah Jones",
        }),
      ],
      now
    );
    expect(items).toEqual([
      expect.objectContaining({
        id: "q1",
        customer: "Sarah Jones",
        reason: "Customer question",
        kind: "customer_question",
        href: "/proposals/q1",
      }),
    ]);
  });

  it("counts a customer change request", () => {
    const items = buildHomeAttentionItems(
      [
        proposal({
          id: "c1",
          status: "needs_attention",
          attention_reason: "customer_requested_changes",
          customer_name: "Michael Carter",
        }),
      ],
      now
    );
    expect(items[0]).toMatchObject({
      customer: "Michael Carter",
      reason: "Customer requested a change",
      kind: "customer_change",
      href: "/proposals/c1",
    });
  });

  it("counts a quote ready to send", () => {
    const items = buildHomeAttentionItems(
      [
        proposal({
          id: "ready-1",
          status: "ready_to_send",
          customer_name: "Sarah Jones",
        }),
      ],
      now
    );
    expect(items[0]).toMatchObject({
      customer: "Sarah Jones",
      reason: "Quote ready to send",
      kind: "quote_ready_to_send",
      href: "/proposals/ready-1",
    });
  });

  it("counts a quote to finish", () => {
    const items = buildHomeAttentionItems(
      [
        proposal({
          id: "draft-1",
          status: "draft",
          customer_name: "Alex Draft",
        }),
      ],
      now
    );
    expect(items[0]).toMatchObject({
      reason: "Quote to finish",
      kind: "quote_to_finish",
      href: "/proposals/draft-1/edit",
    });
  });

  it("counts a job that needs scheduling", () => {
    const items = buildHomeAttentionItems(
      [
        proposal({
          id: "sched-1",
          status: "booked",
          customer_name: "David Brown",
          accepted_at: "2026-08-08T12:00:00.000Z",
        }),
      ],
      now
    );
    expect(items[0]).toMatchObject({
      customer: "David Brown",
      reason: "Job needs scheduling",
      kind: "job_to_schedule",
      href: "/proposals/sched-1/schedule",
    });
    expect(attentionItemHref("jobs_to_schedule", "sched-1")).toBe(
      "/proposals/sched-1/schedule"
    );
  });

  it("counts a failed send when the quote still needs the trader to retry", () => {
    const failed = {
      ...proposal({
        id: "fail-1",
        status: "ready_to_send",
        customer_name: "Pat Retry",
      }),
      last_send_error: "Resend rejected the message",
    };
    const items = buildHomeAttentionItems([failed], now);
    expect(items[0]).toMatchObject({
      kind: "failed_send",
      reason: "Email failed — tap to retry",
      href: "/proposals/fail-1",
    });
    expect(getHomeAttentionCount([failed], now)).toBe(1);
  });

  it("opens the screen that matches the action", () => {
    expect(attentionItemHref("quotes_to_finish", "p1")).toBe(
      "/proposals/p1/edit"
    );
    expect(attentionItemHref("quotes_ready_to_send", "p2")).toBe(
      "/proposals/p2"
    );
    expect(attentionItemHref("needs_attention", "p3")).toBe("/proposals/p3");
    expect(attentionItemHref("jobs_to_schedule", "p4")).toBe(
      "/proposals/p4/schedule"
    );
  });

  it("reduces the count when the trader action is resolved", () => {
    const open = proposal({
      id: "resolve-1",
      status: "needs_attention",
      attention_reason: "customer_question",
      customer_name: "Sam Resolved",
    });
    expect(getHomeAttentionCount([open], now)).toBe(1);

    const resolved = proposal({
      id: "resolve-1",
      status: "waiting_for_customer",
      attention_reason: null,
      customer_name: "Sam Resolved",
    });
    expect(getHomeAttentionCount([resolved], now)).toBe(0);
    expect(buildHomeAttentionItems([resolved], now)).toEqual([]);
  });

  it("uses a zero state when nothing needs the trader", () => {
    expect(getHomeAttentionCount([], now)).toBe(0);
    expect(buildHomeAttentionItems([], now)).toEqual([]);
    expect(HOME_ATTENTION_EMPTY).toBe("You're all caught up.");
  });
});
