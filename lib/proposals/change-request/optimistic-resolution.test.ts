import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  beginResolutionDismiss,
  completeResolutionDismiss,
  emptyOptimisticResolutionState,
  failResolutionDismiss,
  visibleResolutionSummary,
} from "@/lib/proposals/change-request/optimistic-resolution";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("optimistic conversation resolution", () => {
  it("hides the resolved action immediately without waiting to navigate away", () => {
    const afterTap = beginResolutionDismiss(emptyOptimisticResolutionState());
    expect(visibleResolutionSummary({ title: "Update proposal" }, afterTap.dismissed)).toBeNull();
    expect(afterTap.dismissed).toBe(true);
    expect(afterTap.pending).toBe(true);

    const saved = completeResolutionDismiss(afterTap);
    expect(saved.dismissed).toBe(true);
    expect(saved.pending).toBe(false);
    expect(visibleResolutionSummary({ title: "Update proposal" }, saved.dismissed)).toBeNull();
  });

  it("restores the action if the save fails", () => {
    const pending = beginResolutionDismiss(emptyOptimisticResolutionState());
    const failed = failResolutionDismiss(pending, "Could not mark this request resolved.");
    expect(failed.dismissed).toBe(false);
    expect(visibleResolutionSummary({ title: "Update proposal" }, failed.dismissed)).toEqual({
      title: "Update proposal",
    });
  });

  it("does not wait for router.refresh or a page redirect", () => {
    const panel = readRepo("components/proposals/conversation-resolution-panel.tsx");
    const action = readRepo("lib/proposals/change-request/actions.ts");
    expect(panel).toContain("beginResolutionDismiss");
    expect(panel).toContain("dispatchResolutionDismissed");
    expect(panel).not.toContain("router.refresh");
    expect(panel).not.toContain("useActionState(\n    markChangeRequestResolved");
    expect(action).not.toContain("redirect(");
    expect(action).toContain("return { ok: true }");
  });
});
