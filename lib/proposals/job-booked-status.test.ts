import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WORKSPACE_ACTION_STACK_CLASS,
  WORKSPACE_ACTION_STACK_GAP_DESKTOP,
  WORKSPACE_ACTION_STACK_GAP_MOBILE,
  WORKSPACE_ACTION_STACK_GAP_TOKEN,
} from "@/lib/layout/workspace-action-stack";
import { JOB_BOOKED_STATUS_TITLE } from "@/lib/proposals/date-workflow";

function readRepo(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const workspaceSource = readRepo("components/proposals/proposal-workspace.tsx");
const nextActionsSource = readRepo(
  "components/proposals/proposal-next-actions.tsx"
);
const homeLifecycleSource = readRepo("lib/home/home-lifecycle.ts");
const cssSource = readRepo("app/globals.css");

describe("trader booked-job status", () => {
  it("uses Job booked as the shared status wording", () => {
    expect(JOB_BOOKED_STATUS_TITLE).toBe("Job booked");
    expect(workspaceSource).toContain("{JOB_BOOKED_STATUS_TITLE}");
    expect(nextActionsSource).toContain("JOB_BOOKED_STATUS_TITLE");
    expect(homeLifecycleSource).toContain("JOB_BOOKED_STATUS_TITLE");
    expect(workspaceSource).not.toContain(">Booked job<");
    expect(nextActionsSource).not.toContain('"Booked job"');
    expect(homeLifecycleSource).not.toContain('["Booked job"]');
  });

  it("uses one shared mobile stack gap between status, actions, and Mark complete", () => {
    expect(WORKSPACE_ACTION_STACK_CLASS).toBe("qf-workspace-action-stack");
    expect(WORKSPACE_ACTION_STACK_GAP_TOKEN).toBe("var(--thumb-action-gap)");
    expect(WORKSPACE_ACTION_STACK_GAP_MOBILE).toBe("0.75rem");
    expect(cssSource).toContain("--thumb-action-gap: 0.75rem");
    expect(cssSource).toContain(
      ".qf-workspace-action-stack {\n  --qf-workspace-stack-gap: var(--thumb-action-gap);"
    );
    expect(cssSource).toContain("gap: var(--qf-workspace-stack-gap)");
    expect(cssSource).toContain(".qf-workspace-action-stack > *");
    expect(cssSource).toContain("margin-top: 0");
    expect(cssSource).toContain("margin-bottom: 0");
    expect(cssSource).not.toContain(
      ".qf-date-state-banner-booked + .qf-workspace-actions"
    );
    expect(cssSource).not.toMatch(
      /\.qf-date-state-banner-booked\s*\{[^}]*margin-bottom:\s*1\.25rem/
    );
  });

  it("keeps the action-row gap equal above and below on mobile", () => {
    expect(workspaceSource).toContain(`className={WORKSPACE_ACTION_STACK_CLASS}`);
    expect(workspaceSource).toContain("qf-date-state-banner-booked");
    expect(workspaceSource).toContain("<ProposalWorkspaceActions");
    expect(workspaceSource).toContain("<ProposalLifecycleActions");
    const stackStart = workspaceSource.indexOf(
      `className={WORKSPACE_ACTION_STACK_CLASS}`
    );
    const booked = workspaceSource.indexOf("qf-date-state-banner-booked");
    const actions = workspaceSource.indexOf("<ProposalWorkspaceActions");
    const lifecycle = workspaceSource.indexOf("<ProposalLifecycleActions");
    const stackEnd = workspaceSource.indexOf(
      "</div>",
      workspaceSource.indexOf("<ProposalLifecycleActions")
    );
    expect(stackStart).toBeGreaterThan(-1);
    expect(booked).toBeGreaterThan(-1);
    expect(booked).toBeLessThan(stackStart);
    expect(actions).toBeGreaterThan(stackStart);
    expect(lifecycle).toBeGreaterThan(actions);
    expect(stackEnd).toBeGreaterThan(lifecycle);
    expect(cssSource).toContain(
      ".qf-workspace-actions {\n  display: flex;\n  flex-direction: column;\n  gap: 0.75rem;\n  margin-bottom: 1.5rem;"
    );
    expect(cssSource).toContain(
      ".qf-workspace-actions {\n    gap: 0.5rem;\n    margin-bottom: 0.75rem;"
    );
  });

  it("does not overlap or pull the action row on mobile", () => {
    const stackBlock = cssSource.slice(
      cssSource.indexOf(".qf-workspace-action-stack {"),
      cssSource.indexOf(".qf-workspace-actions {")
    );
    expect(stackBlock).not.toContain("margin-top: -");
    expect(stackBlock).not.toContain("transform:");
    expect(stackBlock).not.toContain("position: absolute");
    expect(stackBlock).toContain("display: flex");
    expect(stackBlock).toContain("flex-direction: column");
  });

  it("keeps desktop on the existing 1.5rem action-stack gap", () => {
    expect(WORKSPACE_ACTION_STACK_GAP_DESKTOP).toBe("1.5rem");
    expect(cssSource).toContain(
      "@media (min-width: 1024px) {\n  .qf-workspace-action-stack {\n    --qf-workspace-stack-gap: 1.5rem;"
    );
    expect(cssSource).toContain(
      ".qf-workspace-actions {\n    gap: 0.75rem;\n    margin-bottom: 1.5rem;"
    );
  });
});
