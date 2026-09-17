import { describe, expect, it } from "vitest";
import { canShowFinalAccept } from "@/lib/proposals/acceptance-rules";
import {
  buildCustomerPortalTimelineStages,
  buildPortalBrandPresentation,
  buildPortalPageLayout,
  getPortalChangeWorkflow,
  isPortalTopLevelActionSet,
  PORTAL_CHANGE_CHOICES,
  PORTAL_DATE_CHANGE_VISUAL,
  PORTAL_FORBIDDEN_CUSTOMER_ACTIONS,
  PORTAL_TOP_LEVEL_ACTIONS,
  PORTAL_VISUAL,
  portalDateChangeCardsAreDark,
  portalSlotCardCopy,
  portalConversationDefaultOpen,
  portalPrimaryActionLabel,
  portalShowsFinalAccept,
  portalTimelineDefaultOpen,
  portalTopLevelActionLabels,
  shouldShowThingsToConfirm,
} from "@/lib/proposals/customer-portal/portal-page-layout";

describe("customer portal page layout", () => {
  it("shows only Accept proposal, Request a change, Ask a question, and Decline", () => {
    const labels = portalTopLevelActionLabels(true);
    expect(labels).toEqual([...PORTAL_TOP_LEVEL_ACTIONS]);
    expect(isPortalTopLevelActionSet(labels)).toBe(true);
    expect(labels).not.toContain("Request different date or time");
    expect(labels).not.toContain("Request different date/time");
  });

  it("opens Request a change as Date, Time, or Job details", () => {
    expect(PORTAL_CHANGE_CHOICES.map((choice) => choice.label)).toEqual([
      "Date",
      "Time",
      "Job details",
    ]);
  });

  it("routes Date into the existing date workflow", () => {
    expect(getPortalChangeWorkflow("date")).toEqual({
      workflow: "date",
      action: "requestAnotherScheduleDate",
    });
  });

  it("routes Time into the existing time workflow", () => {
    expect(getPortalChangeWorkflow("time")).toEqual({
      workflow: "time",
      action: "requestAnotherScheduleTime",
    });
  });

  it("routes Job details into the proposal-change workflow", () => {
    expect(getPortalChangeWorkflow("job_details")).toEqual({
      workflow: "proposal_change",
      action: "requestPublicProposalChanges",
    });
  });

  it("collapses conversation by default on mobile", () => {
    expect(portalConversationDefaultOpen("mobile")).toBe(false);
    expect(buildPortalPageLayout("mobile").conversationDefaultOpen).toBe(false);
  });

  it("can expand conversation and keeps history available", () => {
    const layout = buildPortalPageLayout("desktop");
    expect(layout.conversationCollapsible).toBe(true);
    expect(layout.conversationDefaultOpen).toBe(false);
  });

  it("collapses the proposal timeline by default on mobile", () => {
    expect(portalTimelineDefaultOpen("mobile")).toBe(false);
    expect(buildPortalPageLayout("mobile").timelineDefaultOpen).toBe(false);
    expect(
      buildCustomerPortalTimelineStages({
        issuedLabel: "28 July 2026",
        status: "waiting_for_customer",
        isAccepted: false,
        isDeclined: false,
      }).some((stage) => stage.label === "Proposal issued")
    ).toBe(true);
  });

  it("uses a black page and charcoal cards, not white cards", () => {
    const layout = buildPortalPageLayout("mobile");
    expect(layout.cardsAreWhite).toBe(false);
    expect(layout.pageBackground).toBe("#08080a");
    expect(layout.cardBackground).toBe("#1f1f28");
    expect(PORTAL_VISUAL.cardsAreWhite).toBe(false);
    expect(PORTAL_VISUAL.orangeIsAccentOnly).toBe(true);
  });

  it("hides Things to confirm when nothing is unresolved", () => {
    expect(shouldShowThingsToConfirm([])).toBe(false);
    expect(shouldShowThingsToConfirm(["  "])).toBe(false);
    expect(shouldShowThingsToConfirm(["Confirm tile colour"])).toBe(true);
  });

  it("does not expose trader or admin controls", () => {
    const labels = portalTopLevelActionLabels(true);
    for (const forbidden of PORTAL_FORBIDDEN_CUSTOMER_ACTIONS) {
      expect(labels).not.toContain(forbidden);
    }
  });

  it("uses the business name as the customer-facing hero, not Reanvil", () => {
    const brand = buildPortalBrandPresentation({
      businessName: "Carter & Sons Kitchens",
    });
    expect(brand.heroName).toBe("Carter & Sons Kitchens");
    expect(brand.subtitle).toBe("Your proposal");
    expect(brand.leadWithReanvil).toBe(false);
    expect(brand.productFooter).toBe("Powered by Reanvil");
  });

  it("renders a business logo when a real URL is available", () => {
    const brand = buildPortalBrandPresentation({
      businessName: "Carter & Sons Kitchens",
      businessLogoUrl: "https://cdn.example.com/logo.png",
    });
    expect(brand.showLogo).toBe(true);
    expect(brand.logoUrl).toBe("https://cdn.example.com/logo.png");
  });

  it("uses a clean name-only fallback when no logo exists", () => {
    const brand = buildPortalBrandPresentation({
      businessName: "Carter & Sons Kitchens",
      businessLogoUrl: "   ",
    });
    expect(brand.showLogo).toBe(false);
    expect(brand.logoUrl).toBeNull();
    expect(brand.heroName).toBe("Carter & Sons Kitchens");
  });

  it("keeps existing Accept eligibility rules unchanged", () => {
    const ready = {
      canRespond: true,
      plannedStartDate: "2026-10-13",
      plannedStartTime: "13:00",
      estimatedDuration: "1 hour",
    };
    const notReady = {
      canRespond: true,
      plannedStartDate: null,
      plannedStartTime: null,
      estimatedDuration: "5 working days",
    };
    expect(portalShowsFinalAccept(ready)).toBe(canShowFinalAccept(ready));
    expect(portalShowsFinalAccept(notReady)).toBe(canShowFinalAccept(notReady));
    expect(portalPrimaryActionLabel(true)).toBe("Accept proposal");
    expect(portalPrimaryActionLabel(false)).toBe("Choose a date");
  });

  it("uses dark date-option cards with readable text", () => {
    expect(portalDateChangeCardsAreDark()).toBe(true);
    expect(PORTAL_DATE_CHANGE_VISUAL.cardsAreWhite).toBe(false);
    expect(PORTAL_DATE_CHANGE_VISUAL.optionBackground).toBe("#16161e");
    expect(PORTAL_DATE_CHANGE_VISUAL.optionText).toBe("#f5f5f7");
    expect(PORTAL_DATE_CHANGE_VISUAL.optionMuted).toBe("#a1a1aa");
    expect(PORTAL_DATE_CHANGE_VISUAL.optionBackground).not.toBe("#ffffff");
    expect(PORTAL_DATE_CHANGE_VISUAL.optionText).not.toBe(
      PORTAL_DATE_CHANGE_VISUAL.optionBackground
    );
  });

  it("makes the selected date state visible with an orange border", () => {
    expect(PORTAL_DATE_CHANGE_VISUAL.selectedBorder).toBe("#ff6a1a");
    expect(PORTAL_VISUAL.orangeIsAccentOnly).toBe(true);
  });

  it("keeps date-change fields and buttons on the portal mobile width", () => {
    expect(PORTAL_DATE_CHANGE_VISUAL.mobileMaxWidth).toBe("100%");
    expect(PORTAL_DATE_CHANGE_VISUAL.fieldBackground).toBe("#0c0c12");
    expect(PORTAL_DATE_CHANGE_VISUAL.usesPageScroll).toBe(true);
    expect(PORTAL_DATE_CHANGE_VISUAL.bottomSafeArea).toBe(
      "env(safe-area-inset-bottom, 0px)"
    );
  });

  it("splits range and appointment labels for the date cards", () => {
    expect(
      portalSlotCardCopy({
        kind: "range",
        label: "18–28 September",
      })
    ).toEqual({ title: "18–28 September", subtitle: "Available window" });
    expect(
      portalSlotCardCopy({
        kind: "appointment",
        label: "Tuesday 22 September · 10:30",
        startTime: "10:30",
      })
    ).toEqual({ title: "Tuesday 22 September", subtitle: "10:30" });
  });

  it("keeps the date-request workflow and desktop portal layout unchanged", () => {
    expect(getPortalChangeWorkflow("date").action).toBe(
      "requestAnotherScheduleDate"
    );
    expect(buildPortalPageLayout("desktop").responsive).toBe(true);
    expect(buildPortalPageLayout("desktop").cardsAreWhite).toBe(false);
    expect(buildPortalPageLayout("mobile").stackedActions).toBe(true);
  });

  it("keeps the customer proposal page responsive", () => {
    const mobile = buildPortalPageLayout("mobile");
    const desktop = buildPortalPageLayout("desktop");
    expect(mobile.responsive).toBe(true);
    expect(desktop.responsive).toBe(true);
    expect(mobile.compactSupportingDetail).toBe(true);
    expect(desktop.compactSupportingDetail).toBe(false);
    expect(mobile.stackedActions).toBe(true);
  });
});
