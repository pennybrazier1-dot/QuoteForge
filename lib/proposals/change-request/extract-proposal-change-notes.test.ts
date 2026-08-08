import { describe, expect, it } from "vitest";
import { extractProposalChangeNotes } from "@/lib/proposals/change-request/extract-proposal-change-notes";

describe("extractProposalChangeNotes", () => {
  it("splits free-text notes into review fields", () => {
    const extract = extractProposalChangeNotes(
      [
        "Add garden wall to the scope",
        "Use grey tiles",
        "May take 1 extra day",
        "Price may go up slightly",
      ].join("\n")
    );

    expect(extract.scopeNotes).toMatch(/garden wall/i);
    expect(extract.materialsNotes).toMatch(/grey tiles/i);
    expect(extract.durationNotes).toMatch(/extra day/i);
    expect(extract.priceNotes).toMatch(/[Pp]rice/i);
  });
});
