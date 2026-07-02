import { describe, expect, it } from "vitest";
import {
  canTransitionStatus,
  isProposalStatus,
  normalizeProposalStatus,
} from "@/lib/proposals/status";

describe("proposal status transitions", () => {
  it("allows ready_to_send to waiting_for_customer", () => {
    expect(canTransitionStatus("ready_to_send", "waiting_for_customer")).toBe(
      true
    );
  });

  it("allows waiting_for_customer to booked", () => {
    expect(canTransitionStatus("waiting_for_customer", "booked")).toBe(true);
  });

  it("allows booked to completed", () => {
    expect(canTransitionStatus("booked", "completed")).toBe(true);
  });

  it("blocks ready_to_send from jumping straight to booked", () => {
    expect(canTransitionStatus("ready_to_send", "booked")).toBe(false);
  });

  it("blocks completed from reopening", () => {
    expect(canTransitionStatus("completed", "booked")).toBe(false);
  });

  it("normalizes legacy accepted status to booked", () => {
    expect(normalizeProposalStatus("accepted")).toBe("booked");
    expect(isProposalStatus("accepted")).toBe(true);
  });
});
