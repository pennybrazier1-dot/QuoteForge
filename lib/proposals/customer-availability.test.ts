import { describe, expect, it } from "vitest";
import {
  buildPublicAvailability,
  decodePublicSlotId,
  formatAppointmentLabel,
  formatRangeLabel,
  INITIAL_PUBLIC_SLOTS,
  publicSlotHasPrivateData,
  scheduleModeForDuration,
  splitPublicAvailability,
  toOccupiedWorkSlots,
} from "@/lib/proposals/customer-availability";
import type { OccupiedWorkSlot } from "@/lib/proposals/slot-hold";

const monday = new Date(2026, 9, 5, 9, 0, 0); // Monday 5 October 2026

function occupied(overrides: Partial<OccupiedWorkSlot> & Pick<OccupiedWorkSlot, "proposalId" | "startDate">): OccupiedWorkSlot {
  return {
    dateState: "confirmed",
    accepted: true,
    ...overrides,
  };
}

describe("customer-safe availability", () => {
  it("shows only continuous working-day windows for a long job", () => {
    expect(scheduleModeForDuration("5 working days")).toBe("range");
    const slots = buildPublicAvailability({
      estimatedDuration: "5 working days",
      occupied: [],
      ignoreProposalId: "kitchen-1",
      fromDate: monday,
      now: monday,
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => slot.kind === "range")).toBe(true);
    expect(slots[0]?.label).toMatch(/–/);
    expect(slots.some((slot) => publicSlotHasPrivateData(slot))).toBe(false);
  });

  it("does not offer a long-job window that overlaps a booked job", () => {
    const slots = buildPublicAvailability({
      estimatedDuration: "5 working days",
      occupied: [
        occupied({
          proposalId: "other-job",
          startDate: "2026-10-06",
          endDate: "2026-10-08",
        }),
      ],
      ignoreProposalId: "kitchen-1",
      fromDate: monday,
      now: monday,
    });

    expect(
      slots.some(
        (slot) => slot.startDate === "2026-10-06" || slot.startDate === "2026-10-05"
      )
    ).toBe(false);
  });

  it("shows offered appointment times for a short job", () => {
    expect(scheduleModeForDuration("1 hour")).toBe("appointment");
    const slots = buildPublicAvailability({
      estimatedDuration: "1 hour",
      occupied: [],
      ignoreProposalId: "blinds-1",
      fromDate: monday,
      now: monday,
    });

    expect(slots.every((slot) => slot.kind === "appointment")).toBe(true);
    expect(slots.some((slot) => slot.startTime === "13:00")).toBe(true);
    expect(slots[0]?.label).toMatch(/·/);
  });

  it("never exposes private calendar names or job titles", () => {
    const occupiedSlots = toOccupiedWorkSlots([
      {
        proposalId: "secret-job",
        startDate: "2026-10-06",
        startTime: "13:00",
        accepted: true,
        dateState: "confirmed",
        customerName: "Michael Carter",
        jobTitle: "Kitchen for the Carters",
      },
    ]);
    const slots = buildPublicAvailability({
      estimatedDuration: "1 hour",
      occupied: occupiedSlots,
      ignoreProposalId: "blinds-1",
      fromDate: monday,
      now: monday,
    });

    const blob = JSON.stringify(slots);
    expect(blob).not.toMatch(/Michael Carter/);
    expect(blob).not.toMatch(/Kitchen for the Carters/);
    expect(slots.some((slot) => publicSlotHasPrivateData(slot))).toBe(false);
    expect(
      slots.some((slot) => slot.startDate === "2026-10-06" && slot.startTime === "13:00")
    ).toBe(false);
  });

  it("only offers slots inside the trader booking window", () => {
    const slots = buildPublicAvailability({
      estimatedDuration: "1 hour",
      occupied: [],
      ignoreProposalId: "blinds-1",
      fromDate: monday,
      now: monday,
      bookingWindow: {
        kind: "custom",
        startDate: "2026-10-12",
        endDate: "2026-10-16",
      },
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((slot) => slot.startDate >= "2026-10-12")).toBe(true);
    expect(slots.every((slot) => (slot.endDate ?? slot.startDate) <= "2026-10-16")).toBe(
      true
    );
  });

  it("shows at most 5 short-job slots until Show more", () => {
    const slots = buildPublicAvailability({
      estimatedDuration: "2 hours",
      occupied: [],
      ignoreProposalId: "blinds-1",
      fromDate: monday,
      now: monday,
      bookingWindow: { kind: "next_month" },
    });
    const split = splitPublicAvailability(slots);
    expect(split.visible.length).toBeLessThanOrEqual(INITIAL_PUBLIC_SLOTS);
    expect(split.visible.length).toBeLessThanOrEqual(5);
    expect(new Set(split.visible.map((slot) => slot.startDate)).size).toBe(
      split.visible.length
    );
    expect(slots.every((slot) => slot.kind === "appointment")).toBe(true);
  });

  it("shows at most 5 non-overlapping long-job windows", () => {
    const slots = buildPublicAvailability({
      estimatedDuration: "4 working days",
      occupied: [],
      ignoreProposalId: "kitchen-1",
      fromDate: monday,
      now: monday,
      bookingWindow: { kind: "next_month" },
    });
    const split = splitPublicAvailability(slots);
    expect(slots.every((slot) => slot.kind === "range")).toBe(true);
    expect(split.visible.length).toBeLessThanOrEqual(5);
    expect(slots.some((slot) => !slot.endDate || slot.endDate === slot.startDate)).toBe(
      false
    );

    for (let i = 1; i < slots.length; i += 1) {
      expect(slots[i]?.startDate > (slots[i - 1]?.endDate ?? "")).toBe(true);
    }
  });

  it("exposes extra slots only through Show more", () => {
    const slots = buildPublicAvailability({
      estimatedDuration: "1 hour",
      occupied: [],
      ignoreProposalId: "blinds-1",
      fromDate: monday,
      now: monday,
      bookingWindow: { kind: "next_month" },
    });
    const split = splitPublicAvailability(slots);
    expect(split.hasMore).toBe(slots.length > 5);
    expect(split.more.length).toBe(Math.max(0, slots.length - 5));
    expect(slots.length).toBeLessThanOrEqual(10);
  });

  it("returns an empty list when the window has no free days", () => {
    const slots = buildPublicAvailability({
      estimatedDuration: "4 working days",
      occupied: [
        occupied({
          proposalId: "other-job",
          startDate: "2026-10-06",
          endDate: "2026-10-16",
        }),
      ],
      ignoreProposalId: "kitchen-1",
      fromDate: monday,
      now: monday,
      bookingWindow: {
        kind: "custom",
        startDate: "2026-10-06",
        endDate: "2026-10-09",
      },
    });
    expect(slots).toEqual([]);
  });

  it("labels a week-based Monday start as week commencing", () => {
    const slots = buildPublicAvailability({
      estimatedDuration: "1 week",
      occupied: [],
      ignoreProposalId: "kitchen-1",
      fromDate: monday,
      now: monday,
      bookingWindow: {
        kind: "custom",
        startDate: "2026-10-12",
        endDate: "2026-10-30",
      },
    });
    expect(slots[0]?.label).toMatch(/Week commencing/i);
  });

  it("round-trips public slot ids without private data", () => {
    const decoded = decodePublicSlotId("appointment|2026-10-13|2026-10-13|13:00");
    expect(decoded).toEqual({
      kind: "appointment",
      startDate: "2026-10-13",
      endDate: "2026-10-13",
      startTime: "13:00",
    });
    expect(formatAppointmentLabel("2026-10-13", "13:00")).toMatch(/13 October/);
    expect(formatRangeLabel("2026-10-05", "2026-10-09")).toBe("5–9 October");
  });
});
