import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PORTAL_DATE_CHANGE_VISUAL } from "@/lib/proposals/customer-portal/portal-page-layout";
import {
  exclusivePortalSelection,
  isPortalSlotSelected,
  PORTAL_SLOT_SELECTION,
  portalSlotFormFields,
  portalSlotInputId,
  portalSlotRadioValue,
  selectPortalSlotFromTarget,
} from "@/lib/proposals/customer-portal/portal-slot-selection";

const morning = {
  id: "appointment|2026-10-06|2026-10-06|10:00",
  startDate: "2026-10-06",
  startTime: "10:00",
};

const afternoon = {
  id: "appointment|2026-10-07|2026-10-07|13:00",
  startDate: "2026-10-07",
  startTime: "13:00",
};

function source(): string {
  return readFileSync(
    join(
      process.cwd(),
      "components/proposals/customer-portal/customer-proposal-portal.tsx"
    ),
    "utf8"
  );
}

describe("portal slot card selection", () => {
  it("selects the slot when the radio is used", () => {
    expect(
      selectPortalSlotFromTarget(morning, "radio", "id")
    ).toBe(morning.id);
    expect(portalSlotRadioValue(morning)).toBe(morning.id);
  });

  it("selects the slot when the date text is tapped", () => {
    expect(
      selectPortalSlotFromTarget(morning, "title", "id")
    ).toBe(morning.id);
  });

  it("selects the slot when the time text is tapped", () => {
    expect(
      selectPortalSlotFromTarget(morning, "subtitle", "id")
    ).toBe(morning.id);
  });

  it("selects the slot when empty card space is tapped", () => {
    expect(
      selectPortalSlotFromTarget(morning, "empty", "id")
    ).toBe(morning.id);
    expect(PORTAL_SLOT_SELECTION.wholeCardSelects).toBe(true);
    expect(PORTAL_SLOT_SELECTION.tapTargets).toEqual([
      "radio",
      "title",
      "subtitle",
      "empty",
    ]);
  });

  it("marks the selected card with the orange selected state", () => {
    expect(PORTAL_SLOT_SELECTION.selectedClassName).toBe(
      "cj-portal-slot-selected"
    );
    expect(PORTAL_SLOT_SELECTION.selectedBorder).toBe(
      PORTAL_DATE_CHANGE_VISUAL.selectedBorder
    );
    expect(isPortalSlotSelected(morning, morning.id, "id")).toBe(true);
    expect(isPortalSlotSelected(afternoon, morning.id, "id")).toBe(false);
  });

  it("keeps only one slot selected at a time", () => {
    expect(PORTAL_SLOT_SELECTION.singleSelect).toBe(true);
    expect(
      exclusivePortalSelection([morning.id, afternoon.id], morning.id)
    ).toEqual({
      [morning.id]: true,
      [afternoon.id]: false,
    });
  });

  it("sends the selected slot to the existing request/accept fields", () => {
    expect(portalSlotFormFields("slotId", morning)).toEqual({
      slotId: morning.id,
    });
    expect(portalSlotFormFields("availableDate", morning)).toEqual({
      requestedDate: "2026-10-06",
      requestedTime: "10:00",
    });
    expect(portalSlotFormFields("availableTime", afternoon)).toEqual({
      requestedTime: "13:00",
    });
  });

  it("uses a full-card mobile tap target", () => {
    expect(PORTAL_SLOT_SELECTION.mobileTouch).toBe(true);
    expect(PORTAL_SLOT_SELECTION.minTapHeight).toBe("2.75rem");
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toContain("touch-action: manipulation");
    expect(css).toContain(".cj-portal-slot-inner");
  });

  it("keeps native radio keyboard behaviour", () => {
    expect(PORTAL_SLOT_SELECTION.keyboardRadios).toBe(true);
    expect(PORTAL_SLOT_SELECTION.usesRadioInput).toBe(true);
    expect(PORTAL_SLOT_SELECTION.usesNativeLabel).toBe(true);
    expect(portalSlotInputId("slotId", morning.id)).toContain("portal-slot-");
    const page = source();
    expect(page).toContain('type="radio"');
    expect(page).toContain("htmlFor=");
    expect(page).toContain("portalSlotInputId");
  });

  it("keeps desktop click selection on the whole card", () => {
    expect(PORTAL_SLOT_SELECTION.desktopClick).toBe(true);
    const page = source();
    expect(page).toContain("<label");
    expect(page).toContain("onClick=");
    expect(page).toContain("onSelect(slot)");
    expect(page).toContain("portalSlotRadioValue");
  });
});
