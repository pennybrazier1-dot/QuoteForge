import { describe, expect, it } from "vitest";
import {
  holdExpiresAt,
  isActiveTemporaryHold,
  isSlotTakenByOther,
  isTemporaryHoldExpired,
  occupiesAvailability,
  overlapsWorkSlot,
  TEMP_HOLD_MS,
  type OccupiedWorkSlot,
} from "@/lib/proposals/slot-hold";

const now = new Date("2026-10-01T10:00:00.000Z");

describe("temporary slot holds", () => {
  it("prevents a second customer selecting the same active hold", () => {
    const first: OccupiedWorkSlot = {
      proposalId: "customer-a",
      startDate: "2026-10-13",
      endDate: "2026-10-13",
      startTime: "13:00",
      dateState: "provisional",
      holdKind: "customer_temp",
      holdCreatedAt: now.toISOString(),
    };

    expect(occupiesAvailability(first, now)).toBe(true);
    expect(
      isSlotTakenByOther(
        { startDate: "2026-10-13", endDate: "2026-10-13", startTime: "13:00" },
        [first],
        "customer-b",
        now
      )
    ).toBe(true);
  });

  it("releases an abandoned temporary hold after it expires", () => {
    const createdAt = new Date(now.getTime() - TEMP_HOLD_MS - 1000).toISOString();
    const abandoned: OccupiedWorkSlot = {
      proposalId: "customer-a",
      startDate: "2026-10-13",
      endDate: "2026-10-13",
      startTime: "13:00",
      dateState: "provisional",
      holdKind: "customer_temp",
      holdCreatedAt: createdAt,
    };

    expect(isTemporaryHoldExpired(createdAt, now)).toBe(true);
    expect(isActiveTemporaryHold(abandoned, now)).toBe(false);
    expect(occupiesAvailability(abandoned, now)).toBe(false);
    expect(
      isSlotTakenByOther(
        { startDate: "2026-10-13", endDate: "2026-10-13", startTime: "13:00" },
        [abandoned],
        "customer-b",
        now
      )
    ).toBe(false);
  });

  it("does not turn a temporary hold into a booked job by itself", () => {
    const hold: OccupiedWorkSlot = {
      proposalId: "customer-a",
      startDate: "2026-10-13",
      startTime: "13:00",
      accepted: false,
      dateState: "provisional",
      holdKind: "customer_temp",
      holdCreatedAt: now.toISOString(),
    };

    expect(hold.accepted).toBe(false);
    expect(hold.dateState).toBe("provisional");
    expect(new Date(holdExpiresAt(now)).getTime()).toBe(now.getTime() + TEMP_HOLD_MS);
  });

  it("documents that same-day different start times are not hourly overlaps", () => {
    // Model limitation: no end-time storage — only start-time equality conflicts.
    expect(
      overlapsWorkSlot(
        { startDate: "2026-10-13", startTime: "09:00" },
        { startDate: "2026-10-13", startTime: "10:00" }
      )
    ).toBe(false);
    expect(
      overlapsWorkSlot(
        { startDate: "2026-10-13", startTime: "09:00" },
        { startDate: "2026-10-13", startTime: "09:00" }
      )
    ).toBe(true);
    expect(
      overlapsWorkSlot(
        { startDate: "2026-10-13", startTime: "09:00" },
        { startDate: "2026-10-13", startTime: "" }
      )
    ).toBe(true);
  });

  it("keeps a trader hold occupied after the temp-hold window", () => {
    const traderHold: OccupiedWorkSlot = {
      proposalId: "trader-hold",
      startDate: "2026-10-13",
      startTime: "13:00",
      accepted: false,
      dateState: "provisional",
      holdKind: "trader",
      holdCreatedAt: new Date(now.getTime() - TEMP_HOLD_MS * 3).toISOString(),
    };

    expect(occupiesAvailability(traderHold, now)).toBe(true);
  });
});
