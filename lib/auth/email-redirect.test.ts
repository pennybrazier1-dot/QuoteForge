import { describe, expect, it } from "vitest";
import {
  buildCheckEmailPath,
  getAuthConfirmUrl,
  isDuplicateSignupUser,
} from "@/lib/auth/email-redirect";
import {
  confirmLinkErrorMessage,
  mapVerifyOtpError,
  parseConfirmLinkParams,
} from "@/lib/auth/confirm-link";

describe("signup email redirect helpers", () => {
  it("builds the dedicated check-email path", () => {
    expect(buildCheckEmailPath("Alex@Example.com ")).toBe(
      "/check-email?email=Alex%40Example.com"
    );
  });

  it("builds auth confirm URL from site origin", () => {
    expect(getAuthConfirmUrl().endsWith("/auth/confirm")).toBe(true);
  });

  it("detects duplicate signup responses with empty identities", () => {
    expect(isDuplicateSignupUser({ identities: [] })).toBe(true);
    expect(isDuplicateSignupUser({ identities: [{ id: "1" }] })).toBe(false);
    expect(isDuplicateSignupUser(null)).toBe(false);
  });
});

describe("confirm link helpers", () => {
  it("parses token_hash and type from the confirmation URL", () => {
    const params = parseConfirmLinkParams(
      new URLSearchParams("token_hash=abc&type=signup")
    );
    expect(params).toEqual({
      tokenHash: "abc",
      type: "signup",
      code: null,
    });
  });

  it("maps verify errors to expired vs invalid", () => {
    expect(mapVerifyOtpError("Token has expired or is invalid")).toBe(
      "expired"
    );
    expect(mapVerifyOtpError("otp_expired")).toBe("expired");
    expect(mapVerifyOtpError("Invalid token")).toBe("invalid");
  });

  it("returns clear user-facing confirm error copy", () => {
    expect(confirmLinkErrorMessage("expired")).toContain("expired");
    expect(confirmLinkErrorMessage("invalid")).toContain("invalid");
    expect(confirmLinkErrorMessage("missing")).toContain("incomplete");
  });
});
