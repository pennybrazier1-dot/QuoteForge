import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOOKING_WINDOW,
  parseBookingWindowFromForm,
  resolveBookingWindow,
  slotFallsInsideWindow,
} from "@/lib/proposals/booking-window";

const monday = new Date(2026, 9, 5, 9, 0, 0);

describe("trader booking window", () => {
  it("resolves the next 2 weeks from tomorrow", () => {
    const window = resolveBookingWindow({ kind: "next_2_weeks" }, monday);
    expect(window.startDate).toBe("2026-10-06");
    expect(window.endDate).toBe("2026-10-19");
    expect(window.kind).toBe("next_2_weeks");
  });

  it("resolves the next month from tomorrow", () => {
    const window = resolveBookingWindow({ kind: "next_month" }, monday);
    expect(window.startDate).toBe("2026-10-06");
    expect(window.endDate).toBe("2026-11-04");
    expect(window.kind).toBe("next_month");
  });

  it("resolves a specific month", () => {
    const window = resolveBookingWindow(
      { kind: "specific_month", month: "2026-10" },
      monday
    );
    expect(window.startDate).toBe("2026-10-06");
    expect(window.endDate).toBe("2026-10-31");
    expect(window.label).toBe("October 2026");
  });

  it("resolves a custom range", () => {
    const window = resolveBookingWindow(
      {
        kind: "custom",
        startDate: "2026-10-12",
        endDate: "2026-10-20",
      },
      monday
    );
    expect(window.startDate).toBe("2026-10-12");
    expect(window.endDate).toBe("2026-10-20");
  });

  it("reads the window from the trader form", () => {
    const data = new FormData();
    data.set("bookingWindowKind", "specific_month");
    data.set("bookingWindowMonth", "2026-11");
    expect(parseBookingWindowFromForm(data)).toEqual({
      kind: "specific_month",
      month: "2026-11",
      startDate: undefined,
      endDate: undefined,
    });
    expect(DEFAULT_BOOKING_WINDOW.kind).toBe("next_month");
  });

  it("keeps customer slots inside the chosen window", () => {
    const window = resolveBookingWindow(
      { kind: "specific_month", month: "2026-10" },
      monday
    );
    expect(
      slotFallsInsideWindow(
        { startDate: "2026-10-12", endDate: "2026-10-15" },
        window
      )
    ).toBe(true);
    expect(
      slotFallsInsideWindow(
        { startDate: "2026-11-02", endDate: "2026-11-05" },
        window
      )
    ).toBe(false);
  });
});
