import { describe, expect, it } from "vitest";
import {
  EnquiryPersistError,
  isStorageQuotaError,
  toEnquiryPersistError,
} from "@/lib/enquiries/persist-errors";

describe("enquiry persist errors", () => {
  it("detects storage quota errors", () => {
    const error = new DOMException("Quota exceeded", "QuotaExceededError");
    expect(isStorageQuotaError(error)).toBe(true);
  });

  it("maps quota errors to a friendly message", () => {
    const error = new DOMException("Quota exceeded", "QuotaExceededError");
    const mapped = toEnquiryPersistError(error);

    expect(mapped).toBeInstanceOf(EnquiryPersistError);
    expect(mapped.message).toContain("storage is full");
  });

  it("passes through enquiry persist errors unchanged", () => {
    const error = new EnquiryPersistError("Custom failure");
    expect(toEnquiryPersistError(error)).toBe(error);
  });
});
