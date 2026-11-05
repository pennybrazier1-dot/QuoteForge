import { describe, expect, it } from "vitest";
import {
  isValidBusinessEmail,
  isValidBusinessWebsite,
  isValidUkCompanyNumber,
  isValidUkPhone,
  isValidUkPostcode,
  isValidUkVatNumber,
  normalizeBusinessWebsite,
  normalizeUkCompanyNumber,
  normalizeUkPostcode,
  normalizeUkVatNumber,
} from "@/lib/workspace/uk-business-validation";
import {
  validateWorkspaceLogoFile,
  WORKSPACE_LOGO_MAX_BYTES,
} from "@/lib/workspace/branding-logo";

describe("uk business validation", () => {
  it("validates email, phone, postcode and VAT", () => {
    expect(isValidBusinessEmail("sam@example.test")).toBe(true);
    expect(isValidBusinessEmail("not-an-email")).toBe(false);
    expect(isValidUkPhone("07700900123")).toBe(true);
    expect(isValidUkPhone("+44 7700 900123")).toBe(true);
    expect(isValidUkPhone("123")).toBe(false);
    expect(isValidUkPostcode("NN1 1AA")).toBe(true);
    expect(isValidUkPostcode("bad")).toBe(false);
    expect(normalizeUkPostcode("nn11aa")).toBe("NN1 1AA");
    expect(isValidUkVatNumber("")).toBe(true);
    expect(isValidUkVatNumber("GB123456789")).toBe(true);
    expect(isValidUkVatNumber("abc")).toBe(false);
    expect(normalizeUkVatNumber("123456789")).toBe("GB123456789");
  });

  it("accepts blank optional website and company number", () => {
    expect(isValidBusinessWebsite("")).toBe(true);
    expect(normalizeBusinessWebsite("")).toBeNull();
    expect(isValidUkCompanyNumber("")).toBe(true);
    expect(normalizeUkCompanyNumber("")).toBeNull();
  });

  it("normalises bare domains and validates company numbers", () => {
    expect(normalizeBusinessWebsite("www.example.co.uk")).toBe(
      "https://www.example.co.uk"
    );
    expect(isValidBusinessWebsite("https://www.example.co.uk")).toBe(true);
    expect(isValidBusinessWebsite("not a url")).toBe(false);
    expect(isValidUkCompanyNumber("12345678")).toBe(true);
    expect(isValidUkCompanyNumber("SC123456")).toBe(true);
    expect(isValidUkCompanyNumber("12")).toBe(false);
    expect(normalizeUkCompanyNumber(" sc123456 ")).toBe("SC123456");
  });
});

describe("workspace logo validation", () => {
  it("accepts a tiny JPEG and rejects oversized files", async () => {
    const jpeg = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0xff, 0xd9,
    ]);
    const ok = await validateWorkspaceLogoFile(
      new File([jpeg], "logo.jpg", { type: "image/jpeg" })
    );
    expect(ok.ok).toBe(true);

    const huge = new Uint8Array(WORKSPACE_LOGO_MAX_BYTES + 1);
    huge[0] = 0xff;
    huge[1] = 0xd8;
    huge[2] = 0xff;
    const fail = await validateWorkspaceLogoFile(
      new File([huge], "big.jpg", { type: "image/jpeg" })
    );
    expect(fail.ok).toBe(false);
  });

  it("rejects non-image content spoofed as jpeg", async () => {
    const result = await validateWorkspaceLogoFile(
      new File([Uint8Array.from([1, 2, 3, 4])], "fake.jpg", {
        type: "image/jpeg",
      })
    );
    expect(result.ok).toBe(false);
  });
});
