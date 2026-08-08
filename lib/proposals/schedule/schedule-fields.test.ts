import { describe, expect, it } from "vitest";
import {
  buildScheduleDateLabel,
  buildScheduleWorkspacePath,
  formatPlannedStartTimeLabel,
  normalizePlannedStartTime,
} from "@/lib/proposals/schedule/schedule-fields";

describe("schedule-fields", () => {
  it("normalizes HH:MM start times", () => {
    expect(normalizePlannedStartTime("09:00")).toBe("09:00");
    expect(normalizePlannedStartTime(" 17:30 ")).toBe("17:30");
    expect(normalizePlannedStartTime("9:00")).toBeNull();
    expect(normalizePlannedStartTime("25:00")).toBeNull();
  });

  it("formats start times for traders", () => {
    expect(formatPlannedStartTimeLabel("09:00")).toBe("9:00am");
    expect(formatPlannedStartTimeLabel("12:00")).toBe("12:00pm");
    expect(formatPlannedStartTimeLabel("00:30")).toBe("12:30am");
  });

  it("builds schedule workspace paths with suggested dates", () => {
    expect(buildScheduleWorkspacePath("p1")).toBe("/proposals/p1/schedule");
    expect(
      buildScheduleWorkspacePath("p1", {
        suggestedDateText: "12 October",
        suggestedDateExact: "2026-10-12",
      })
    ).toBe(
      "/proposals/p1/schedule?suggestedDate=12+October&suggestedDateExact=2026-10-12"
    );
  });

  it("combines date and time into a label", () => {
    expect(
      buildScheduleDateLabel({
        dateIso: "2026-10-12",
        time: "09:00",
      })
    ).toMatch(/12 Oct/i);
    expect(
      buildScheduleDateLabel({
        dateIso: "2026-10-12",
        time: "09:00",
      })
    ).toMatch(/9:00am/i);
  });
});
