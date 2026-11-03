import { describe, expect, it } from "vitest";
import { precheckAcceptAtRevision } from "@/lib/proposals/revision/accept-at-revision";

describe("precheckAcceptAtRevision", () => {
  it("allows original revision 0", () => {
    expect(
      precheckAcceptAtRevision({
        expectedContentRevision: 0,
        unsent_revision_at: null,
        content_revision: 0,
        total_amount: 78000,
      })
    ).toEqual({ ok: true });
  });

  it("allows issued revised quote when expected matches", () => {
    expect(
      precheckAcceptAtRevision({
        expectedContentRevision: 1,
        unsent_revision_at: null,
        content_revision: 1,
        issued_content_revision: 1,
        total_amount: 92000,
      })
    ).toEqual({ ok: true });
  });

  it("rejects stale expected revision from an old portal tab", () => {
    const result = precheckAcceptAtRevision({
      expectedContentRevision: 0,
      unsent_revision_at: null,
      content_revision: 1,
      issued_content_revision: 1,
      total_amount: 92000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.staleRevision).toBe(true);
      expect(result.error.toLowerCase()).toContain("refresh");
    }
  });

  it("rejects unsent revisions", () => {
    const result = precheckAcceptAtRevision({
      expectedContentRevision: 1,
      unsent_revision_at: "2026-11-03T00:00:00.000Z",
      content_revision: 1,
      issued_content_revision: null,
      total_amount: 92000,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects revised quotes that are not issued", () => {
    const result = precheckAcceptAtRevision({
      expectedContentRevision: 1,
      unsent_revision_at: null,
      content_revision: 1,
      issued_content_revision: null,
      total_amount: 92000,
    });
    expect(result.ok).toBe(false);
  });
});
