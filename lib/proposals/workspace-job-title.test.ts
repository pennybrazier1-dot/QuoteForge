import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWorkspaceJobTitle } from "@/lib/proposals/workspace-job-title";

const workspaceSource = readFileSync(
  join(process.cwd(), "components/proposals/proposal-workspace.tsx"),
  "utf8"
);

describe("workspace job title", () => {
  it("shows a short job title near the top of the booked-job page", () => {
    expect(
      resolveWorkspaceJobTitle({
        title: "Garden makeover",
        jobSummary:
          "Full garden makeover including new paving, planting and a patio.",
      })
    ).toBe("Garden makeover");
    expect(workspaceSource).toContain("resolveWorkspaceJobTitle");
    expect(workspaceSource).toContain("qf-workspace-job-title");
    expect(workspaceSource.indexOf("qf-workspace-job-title")).toBeLessThan(
      workspaceSource.indexOf('id="job-preparation"')
    );
    expect(workspaceSource.indexOf("qf-workspace-job-title")).toBeLessThan(
      workspaceSource.indexOf("qf-workspace-meta")
    );
  });

  it("does not use the full scope paragraph as the title", () => {
    expect(
      resolveWorkspaceJobTitle({
        title: "Proposal for Jessica",
        jobSummary:
          "Full garden makeover including new paving, planting and a patio.",
      })
    ).toBe("Garden makeover");
    expect(
      resolveWorkspaceJobTitle({
        jobSummary:
          "Full bathroom renovation including removal of the old suite, replacement of sanitaryware, tiling and installation of a new shower.",
      })
    ).toBe("Bathroom renovation");
    expect(
      resolveWorkspaceJobTitle({
        title:
          "Full bathroom renovation including removal of the old suite, replacement of sanitaryware, tiling and installation of a new shower.",
      })
    ).toBe("Bathroom renovation");
  });
});
