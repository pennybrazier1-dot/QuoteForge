import type { PublicAvailabilitySlot } from "@/lib/proposals/customer-availability";

export const PORTAL_SLOT_SELECTION = {
  wholeCardSelects: true,
  usesNativeLabel: true,
  usesRadioInput: true,
  selectedClassName: "cj-portal-slot-selected",
  selectedBorder: "#ff6a1a",
  singleSelect: true,
  keyboardRadios: true,
  desktopClick: true,
  mobileTouch: true,
  minTapHeight: "2.75rem",
  tapTargets: ["radio", "title", "subtitle", "empty"] as const,
} as const;

export type PortalSlotTapTarget =
  (typeof PORTAL_SLOT_SELECTION.tapTargets)[number];

export type PortalSlotMatchBy = "id" | "startDate" | "startTime";

export function portalSlotInputId(name: string, slotId: string): string {
  return `portal-slot-${name}-${slotId.replace(/[^a-zA-Z0-9]+/g, "-")}`;
}

export function portalSlotRadioValue(slot: Pick<PublicAvailabilitySlot, "id">): string {
  return slot.id;
}

export function portalSlotSelectionValue(
  slot: Pick<PublicAvailabilitySlot, "id" | "startDate" | "startTime">,
  matchBy: PortalSlotMatchBy
): string {
  if (matchBy === "startDate") {
    return slot.startDate;
  }
  if (matchBy === "startTime") {
    return slot.startTime || "";
  }
  return slot.id;
}

export function isPortalSlotSelected(
  slot: Pick<PublicAvailabilitySlot, "id" | "startDate" | "startTime">,
  selectedValue: string,
  matchBy: PortalSlotMatchBy
): boolean {
  return portalSlotSelectionValue(slot, matchBy) === selectedValue;
}

/** Any part of the card selects the same slot as the radio. */
export function selectPortalSlotFromTarget(
  slot: Pick<PublicAvailabilitySlot, "id" | "startDate" | "startTime">,
  target: PortalSlotTapTarget,
  matchBy: PortalSlotMatchBy
): string {
  void target;
  return portalSlotSelectionValue(slot, matchBy);
}

export function exclusivePortalSelection(
  slotIds: string[],
  selectedId: string
): Record<string, boolean> {
  return Object.fromEntries(slotIds.map((id) => [id, id === selectedId]));
}

export function portalSlotFormFields(
  name: "slotId" | "availableDate" | "availableTime",
  slot: Pick<PublicAvailabilitySlot, "id" | "startDate" | "startTime">
): Record<string, string> {
  if (name === "slotId") {
    return { slotId: slot.id };
  }
  if (name === "availableDate") {
    return {
      requestedDate: slot.startDate,
      requestedTime: slot.startTime || "",
    };
  }
  return { requestedTime: slot.startTime || "" };
}
