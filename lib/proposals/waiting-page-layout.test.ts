import { describe, expect, it } from "vitest";
import { canShowResendWaitingProposal } from "@/lib/proposals/proposal-action-eligibility";
import {
  WAITING_PAGE_STATUS_TITLE,
  buildWaitingPageLayout,
  defaultWorkspaceDisclosureOpen,
  isWaitingForCustomerPage,
  shouldShowWaitingDateConfirmedBanner,
  shouldShowWaitingLifecycleCard,
  waitingPageForbiddenCopy,
  waitingPageStatusSupport,
  waitingPageTopActions,
} from "@/lib/proposals/waiting-page-layout";
import {
  isBookedJob,
  buildDateWorkflowSnapshot,
} from "@/lib/proposals/date-workflow";

describe("waiting for customer page layout", () => {
  it("uses a compact status instead of a large explanation", () => {
    const layout = buildWaitingPageLayout({
      status: "waiting_for_customer",
      customerName: "Michael Carter",
      viewport: "mobile",
    });

    expect(layout.statusTitle).toBe("Waiting for customer response");
    expect(layout.statusTitle).toBe(WAITING_PAGE_STATUS_TITLE);
    expect(layout.statusSupport).toBe("Proposal sent to Michael Carter");
    expect(layout.showWaitingLifecycleCard).toBe(false);
    expect(waitingPageStatusSupport("Michael Carter")).toBe(
      "Proposal sent to Michael Carter"
    );
    for (const phrase of waitingPageForbiddenCopy()) {
      expect(layout.statusTitle).not.toContain(phrase);
      expect(layout.statusSupport).not.toContain(phrase);
    }
  });

  it("does not repeat a large date-confirmed status block", () => {
    expect(shouldShowWaitingDateConfirmedBanner("waiting_for_customer")).toBe(
      false
    );
    const layout = buildWaitingPageLayout({
      status: "waiting_for_customer",
      customerName: "Michael Carter",
      viewport: "mobile",
    });
    expect(layout.showDateConfirmedBanner).toBe(false);
    expect(layout.forbiddenCopy).toEqual(
      expect.arrayContaining(["Date confirmed ✓"])
    );
  });

  it("collapses conversation by default on mobile", () => {
    expect(defaultWorkspaceDisclosureOpen("mobile")).toBe(false);
    expect(
      buildWaitingPageLayout({
        status: "waiting_for_customer",
        viewport: "mobile",
      }).conversationDefaultOpen
    ).toBe(false);
  });

  it("lets conversation expand from the collapsed heading", () => {
    expect(defaultWorkspaceDisclosureOpen("mobile")).toBe(false);
    expect(defaultWorkspaceDisclosureOpen("desktop")).toBe(true);
  });

  it("collapses the proposal timeline by default on mobile", () => {
    expect(
      buildWaitingPageLayout({
        status: "waiting_for_customer",
        viewport: "mobile",
      }).timelineDefaultOpen
    ).toBe(false);
  });

  it("lets the timeline expand", () => {
    expect(defaultWorkspaceDisclosureOpen("desktop")).toBe(true);
    expect(
      buildWaitingPageLayout({
        status: "waiting_for_customer",
        viewport: "desktop",
      }).timelineDefaultOpen
    ).toBe(true);
  });

  it("keeps Resend proposal available", () => {
    expect(canShowResendWaitingProposal("waiting_for_customer")).toBe(true);
    expect(waitingPageTopActions("waiting_for_customer").resend).toBe(true);
  });

  it("keeps the PDF action available", () => {
    expect(waitingPageTopActions("waiting_for_customer").pdf).toBe(true);
  });

  it("does not change lifecycle or booked-job rules", () => {
    expect(isWaitingForCustomerPage("waiting_for_customer")).toBe(true);
    expect(shouldShowWaitingLifecycleCard("waiting_for_customer")).toBe(false);
    expect(
      isBookedJob(false, "confirmed")
    ).toBe(false);
    const snapshot = buildDateWorkflowSnapshot({
      status: "waiting_for_customer",
      bookingConfirmation: "confirmed",
      plannedStartDate: "2026-08-12",
      plannedStartTime: "10:30",
    });
    expect(snapshot.isBookedJob).toBe(false);
    expect(snapshot.waitingForProposalAcceptance).toBe(true);
    expect(
      buildWaitingPageLayout({
        status: "waiting_for_customer",
        viewport: "mobile",
      }).lifecycleUnchanged
    ).toBe(true);
  });

  it("keeps the desktop layout functional", () => {
    const layout = buildWaitingPageLayout({
      status: "waiting_for_customer",
      customerName: "Michael Carter",
      viewport: "desktop",
    });
    expect(layout.conversationDefaultOpen).toBe(true);
    expect(layout.timelineDefaultOpen).toBe(true);
    expect(layout.customerDetailsDefaultOpen).toBe(true);
    expect(layout.topActions).toEqual({
      resend: true,
      pdf: true,
      edit: true,
    });
    expect(layout.statusTitle).toBe("Waiting for customer response");
  });
});
