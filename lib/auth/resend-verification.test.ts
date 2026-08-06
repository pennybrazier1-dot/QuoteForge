import { describe, expect, it } from "vitest";
import {
  formatResendCooldownLabel,
  nextCooldownEndsAt,
  RESEND_COOLDOWN_SECONDS,
  resendSuccessMessage,
  secondsUntil,
} from "@/lib/auth/resend-verification";

describe("resend verification helpers", () => {
  it("uses a 60 second cooldown", () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
    expect(nextCooldownEndsAt(1_000_000)).toBe(1_000_000 + 60_000);
  });

  it("formats countdown labels", () => {
    expect(formatResendCooldownLabel(0)).toBe("Resend verification email");
    expect(formatResendCooldownLabel(60)).toBe("Resend in 60s");
    expect(formatResendCooldownLabel(1)).toBe("Resend in 1s");
  });

  it("computes remaining seconds from an end timestamp", () => {
    expect(secondsUntil(10_000, 9_100)).toBe(1);
    expect(secondsUntil(10_000, 10_000)).toBe(0);
    expect(secondsUntil(10_000, 12_000)).toBe(0);
  });

  it("returns the success copy for a completed resend", () => {
    expect(resendSuccessMessage()).toBe(
      "We've sent another verification email."
    );
  });
});
