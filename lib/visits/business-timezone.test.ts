import { describe, expect, it } from "vitest";
import {
  BUSINESS_TIME_ZONE,
  formatLondonWallTimeFromUtcIso,
  resolveLondonLocalDateTime,
} from "@/lib/visits/business-timezone";
import {
  buildVisitStartsAt,
  resolveVisitStartsAt,
} from "@/lib/visits/customer-confirmation/starts-at";

describe("Europe/London appointment time safety", () => {
  it("uses Europe/London as the business timezone", () => {
    expect(BUSINESS_TIME_ZONE).toBe("Europe/London");
  });

  it("keeps UK winter (GMT) wall times at the same UTC hour", () => {
    expect(resolveLondonLocalDateTime("2026-01-15", "10:00")).toEqual({
      ok: true,
      utcIso: "2026-01-15T10:00:00.000Z",
    });
    expect(buildVisitStartsAt("2026-11-04", "14:30")).toBe(
      "2026-11-04T14:30:00.000Z"
    );
  });

  it("stores UK summer (BST) wall times as the previous UTC hour", () => {
    expect(resolveLondonLocalDateTime("2026-08-10", "10:00")).toEqual({
      ok: true,
      utcIso: "2026-08-10T09:00:00.000Z",
    });
    expect(buildVisitStartsAt("2026-07-01", "10:00")).toBe(
      "2026-07-01T09:00:00.000Z"
    );
    const wall = formatLondonWallTimeFromUtcIso("2026-08-10T09:00:00.000Z");
    expect(wall).toEqual({ date: "2026-08-10", time: "10:00" });
  });

  it("rejects nonexistent spring-forward local times", () => {
    // Clocks jump 01:00 GMT -> 02:00 BST on 29 March 2026; 01:30 does not exist.
    const resolved = resolveLondonLocalDateTime("2026-03-29", "01:30");
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.code).toBe("nonexistent");
      expect(resolved.message).toMatch(/does not exist/i);
    }
    expect(buildVisitStartsAt("2026-03-29", "01:30")).toBeNull();
    expect(resolveVisitStartsAt("2026-03-29", "01:30").ok).toBe(false);
  });

  it("rejects ambiguous autumn fold local times", () => {
    // Clocks fall back 02:00 BST -> 01:00 GMT on 25 October 2026; 01:30 is ambiguous.
    const resolved = resolveLondonLocalDateTime("2026-10-25", "01:30");
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.code).toBe("ambiguous");
      expect(resolved.message).toMatch(/twice/i);
    }
    expect(buildVisitStartsAt("2026-10-25", "01:30")).toBeNull();
  });

  it("reschedules across DST without shifting the typed wall clock", () => {
    const winter = buildVisitStartsAt("2026-01-15", "10:00");
    const summer = buildVisitStartsAt("2026-07-01", "10:00");
    expect(formatLondonWallTimeFromUtcIso(winter!)).toEqual({
      date: "2026-01-15",
      time: "10:00",
    });
    expect(formatLondonWallTimeFromUtcIso(summer!)).toEqual({
      date: "2026-07-01",
      time: "10:00",
    });
    expect(winter).toBe("2026-01-15T10:00:00.000Z");
    expect(summer).toBe("2026-07-01T09:00:00.000Z");
  });
});
