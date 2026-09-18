import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPrepChecklistRows } from "@/lib/jobs/prep-checklist";
import {
  applyPrepStatusOverrides,
  beginPrepStatusUpdate,
  canQueuePrepUpdate,
  completePrepStatusUpdate,
  emptyOptimisticPrepState,
  failPrepStatusUpdate,
  isPrepRowPending,
  PREP_UPDATE_ERROR,
  reconcilePrepOverrides,
} from "@/lib/jobs/optimistic-prep";
import type { JobPrepItemStatus } from "@/lib/jobs/prep-items";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const items = [
  { id: "i-customer", item_key: "customer_details" as const, status: "open" as const },
  { id: "i-measure", item_key: "measurements" as const, status: "open" as const },
  { id: "i-materials", item_key: "materials" as const, status: "open" as const },
  { id: "i-access", item_key: "access_requirements" as const, status: "open" as const },
  { id: "i-visit", item_key: "site_visit" as const, status: "open" as const },
];

function visibleRows(state: ReturnType<typeof emptyOptimisticPrepState>) {
  return buildPrepChecklistRows({
    items: applyPrepStatusOverrides(items, state.overrides),
    linkedVisit: null,
  });
}

describe("optimistic job preparation updates", () => {
  it("shows Confirmed immediately, before any server response", () => {
    const afterTap = beginPrepStatusUpdate(
      emptyOptimisticPrepState(),
      "i-materials",
      "confirmed"
    );
    const row = visibleRows(afterTap).find((item) => item.key === "materials");
    expect(row?.statusLabel).toBe("Confirmed");
    expect(row?.tone).toBe("done");
    expect(afterTap.pendingIds).toEqual(["i-materials"]);
  });

  it("shows Not needed immediately", () => {
    const afterTap = beginPrepStatusUpdate(
      emptyOptimisticPrepState(),
      "i-access",
      "not_needed"
    );
    const row = visibleRows(afterTap).find(
      (item) => item.key === "access_requirements"
    );
    expect(row?.statusLabel).toBe("Not needed");
    expect(row?.tone).toBe("skip");
  });

  it("keeps the optimistic state after a successful save", () => {
    const pending = beginPrepStatusUpdate(
      emptyOptimisticPrepState(),
      "i-customer",
      "confirmed"
    );
    const saved = completePrepStatusUpdate(pending, "i-customer");
    const row = visibleRows(saved).find((item) => item.key === "customer_details");
    expect(row?.statusLabel).toBe("Confirmed");
    expect(saved.pendingIds).toEqual([]);
    expect(saved.overrides["i-customer"]).toBe("confirmed");
    expect(saved.error).toBeNull();
  });

  it("rolls back and shows a retry error when the save fails", () => {
    const pending = beginPrepStatusUpdate(
      emptyOptimisticPrepState(),
      "i-measure",
      "confirmed"
    );
    const failed = failPrepStatusUpdate(pending, "i-measure");
    const row = visibleRows(failed).find((item) => item.key === "measurements");
    expect(row?.statusLabel).toBe("Needs confirming");
    expect(row?.tone).toBe("open");
    expect(failed.overrides["i-measure"]).toBeUndefined();
    expect(failed.error).toBe(PREP_UPDATE_ERROR);
    expect(failed.error).toBe("Could not update. Try again.");
    expect(failed.pendingIds).toEqual([]);
  });

  it("ignores a rapid double tap so only one write is queued", () => {
    const first = beginPrepStatusUpdate(
      emptyOptimisticPrepState(),
      "i-materials",
      "confirmed"
    );
    expect(canQueuePrepUpdate(first, "i-materials")).toBe(false);
    const second = beginPrepStatusUpdate(first, "i-materials", "not_needed");
    expect(second).toEqual(first);
    expect(second.pendingIds).toEqual(["i-materials"]);
    expect(second.overrides["i-materials"]).toBe("confirmed");
  });

  it("marks only the affected row pending and leaves other rows interactive", () => {
    const pending = beginPrepStatusUpdate(
      emptyOptimisticPrepState(),
      "i-materials",
      "confirmed"
    );
    expect(isPrepRowPending(pending.pendingIds, "i-materials")).toBe(true);
    expect(isPrepRowPending(pending.pendingIds, "i-access")).toBe(false);
    expect(canQueuePrepUpdate(pending, "i-access")).toBe(true);
    const other = visibleRows(pending).find(
      (item) => item.key === "access_requirements"
    );
    expect(other?.statusLabel).toBe("Needs confirming");
    expect(other?.showMoreMenu).toBe(true);
  });

  it("does not introduce a full-page loading path", () => {
    const panel = readRepo("components/proposals/job-preparation-panel.tsx");
    const action = readRepo("lib/jobs/actions.ts");
    expect(panel).not.toContain("useActionState");
    expect(panel).not.toContain("router.refresh");
    expect(panel).not.toContain("disabled={pending}");
    expect(panel).toContain("beginPrepStatusUpdate");
    expect(panel).not.toMatch(/full-?page loading/i);
    expect(action).not.toContain('revalidatePath("/dashboard")');
    expect(action).not.toContain('revalidatePath("/calendar")');
    expect(action).not.toContain('revalidatePath("/proposals")');
    expect(action).toContain("revalidatePath(`/proposals/${proposalId}`)");
  });

  it("keeps the stored open / confirmed / not_needed model", () => {
    const statuses: JobPrepItemStatus[] = ["open", "confirmed", "not_needed"];
    expect(statuses).toEqual(["open", "confirmed", "not_needed"]);
    const confirmed = visibleRows(
      beginPrepStatusUpdate(emptyOptimisticPrepState(), "i-customer", "confirmed")
    ).find((item) => item.key === "customer_details");
    const skipped = visibleRows(
      beginPrepStatusUpdate(emptyOptimisticPrepState(), "i-customer", "not_needed")
    ).find((item) => item.key === "customer_details");
    const open = visibleRows(emptyOptimisticPrepState()).find(
      (item) => item.key === "customer_details"
    );
    expect(confirmed?.status).toBe("confirmed");
    expect(skipped?.status).toBe("not_needed");
    expect(open?.status).toBe("open");
    expect(readRepo("lib/jobs/actions.ts")).toContain("confirmed_at");
    expect(readRepo("lib/jobs/actions.ts")).toContain("item_key");
  });

  it("drops overrides once the server already has the same status", () => {
    const pending = beginPrepStatusUpdate(
      emptyOptimisticPrepState(),
      "i-materials",
      "confirmed"
    );
    const saved = completePrepStatusUpdate(pending, "i-materials");
    const reconciled = reconcilePrepOverrides(saved.overrides, [
      { id: "i-materials", status: "confirmed" },
    ]);
    expect(reconciled).toEqual({});
  });
});
