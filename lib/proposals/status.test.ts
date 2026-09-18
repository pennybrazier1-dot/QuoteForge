import { describe, expect, it } from "vitest";
import {
  canTransitionStatus,
  isClosedProposalStatus,
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

  it("allows a completed job to reopen as booked", () => {
    expect(canTransitionStatus("completed", "booked")).toBe(true);
  });

  it("allows a paid completed job to close", () => {
    expect(canTransitionStatus("completed", "closed")).toBe(true);
  });

  it("normalizes legacy accepted status to booked", () => {
    expect(normalizeProposalStatus("accepted")).toBe("booked");
    expect(isProposalStatus("accepted")).toBe(true);
  });

  it("lets the customer decline a sent proposal", () => {
    expect(canTransitionStatus("waiting_for_customer", "declined")).toBe(true);
    expect(canTransitionStatus("needs_attention", "declined")).toBe(true);
    expect(isClosedProposalStatus("declined")).toBe(true);
    expect(isClosedProposalStatus("cancelled")).toBe(true);
    expect(isClosedProposalStatus("waiting_for_customer")).toBe(false);
  });
});
