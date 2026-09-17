import { normalizeProposalStatus } from "@/lib/proposals/status";

/** Customer still needs to confirm the date. */
export const DATE_SLOT_PROVISIONAL = "provisional";
/** Customer has confirmed the date. This is not automatically a booked job. */
export const DATE_SLOT_CONFIRMED = "confirmed";

export type DateSlotState = "none" | "provisional" | "confirmed";

export type DateWorkflowInput = {
  status: string;
  acceptedAt?: string | null;
  bookingConfirmation?: string | null;
  plannedStartDate?: string | null;
  plannedStartTime?: string | null;
};

export type DateWorkflowSnapshot = {
  dateState: DateSlotState;
  proposalAccepted: boolean;
  isBookedJob: boolean;
  needsScheduleJob: boolean;
  waitingForDateConfirmation: boolean;
  waitingForProposalAcceptance: boolean;
  plannedStartDate: string | null;
  plannedStartTime: string | null;
};

export function hasExactStartDate(
  plannedStartDate: string | null | undefined
): boolean {
  return Boolean(plannedStartDate?.trim());
}

export function readDateSlotState(
  bookingConfirmation: string | null | undefined,
  plannedStartDate?: string | null
): DateSlotState {
  if (!hasExactStartDate(plannedStartDate)) {
    return "none";
  }
  if (bookingConfirmation === DATE_SLOT_CONFIRMED) {
    return "confirmed";
  }
  if (bookingConfirmation === DATE_SLOT_PROVISIONAL) {
    return "provisional";
  }
  return "none";
}

export function isProposalAcceptedStatus(
  status: string,
  acceptedAt?: string | null
): boolean {
  const normalized = normalizeProposalStatus(status);
  return (
    normalized === "booked" ||
    normalized === "completed" ||
    Boolean(acceptedAt)
  );
}

export function isBookedJob(
  proposalAccepted: boolean,
  dateState: DateSlotState
): boolean {
  return proposalAccepted && dateState === "confirmed";
}

export function needsScheduleJob(
  proposalAccepted: boolean,
  dateState: DateSlotState
): boolean {
  return proposalAccepted && dateState !== "confirmed";
}

export function buildDateWorkflowSnapshot(
  input: DateWorkflowInput
): DateWorkflowSnapshot {
  const dateState = readDateSlotState(
    input.bookingConfirmation,
    input.plannedStartDate
  );
  const proposalAccepted = isProposalAcceptedStatus(
    input.status,
    input.acceptedAt
  );

  return {
    dateState,
    proposalAccepted,
    isBookedJob: isBookedJob(proposalAccepted, dateState),
    needsScheduleJob: needsScheduleJob(proposalAccepted, dateState),
    waitingForDateConfirmation: dateState === "provisional",
    waitingForProposalAcceptance:
      !proposalAccepted && dateState === "confirmed",
    plannedStartDate: input.plannedStartDate?.trim() || null,
    plannedStartTime: input.plannedStartTime?.trim() || null,
  };
}

/** Accepting a proposal must never turn a confirmed date back into a hold. */
export function bookingConfirmationAfterAccept(
  dateState: DateSlotState
): "provisional" | "confirmed" | null {
  if (dateState === "confirmed") {
    return "confirmed";
  }
  if (dateState === "provisional") {
    return "provisional";
  }
  return null;
}

export function nextStatusAfterDateResolved(input: {
  proposalAccepted: boolean;
  hasOtherUnresolvedRequests: boolean;
}): "booked" | "needs_attention" | "waiting_for_customer" {
  if (input.proposalAccepted) {
    return "booked";
  }
  if (input.hasOtherUnresolvedRequests) {
    return "needs_attention";
  }
  return "waiting_for_customer";
}

export function applyTraderConfirmDate(current: DateSlotState): {
  next: DateSlotState;
  changed: boolean;
  askCustomerToConfirm: false;
} {
  if (current === "confirmed") {
    return { next: "confirmed", changed: false, askCustomerToConfirm: false };
  }
  return { next: "confirmed", changed: true, askCustomerToConfirm: false };
}

export function applyTraderProvisionalHold(current: DateSlotState): {
  next: DateSlotState;
  changed: boolean;
  notifyCustomer: boolean;
} {
  if (current === "confirmed") {
    return { next: "confirmed", changed: false, notifyCustomer: false };
  }
  if (current === "provisional") {
    return { next: "provisional", changed: false, notifyCustomer: false };
  }
  return { next: "provisional", changed: true, notifyCustomer: true };
}

export function applyCustomerConfirmDate(current: DateSlotState): {
  next: DateSlotState;
  changed: boolean;
  acceptsProposal: false;
} {
  if (current === "confirmed") {
    return { next: "confirmed", changed: false, acceptsProposal: false };
  }
  return { next: "confirmed", changed: true, acceptsProposal: false };
}

export function applyCustomerRequestAnotherDate(): {
  next: DateSlotState;
  releaseHold: true;
  attentionReason: "customer_requested_date_change";
} {
  return {
    next: "none",
    releaseHold: true,
    attentionReason: "customer_requested_date_change",
  };
}

export function sameDateSlot(
  left: { date?: string | null; time?: string | null },
  right: { date?: string | null; time?: string | null }
): boolean {
  return (
    (left.date?.trim() || "") === (right.date?.trim() || "") &&
    (left.time?.trim() || "") === (right.time?.trim() || "")
  );
}

export const HOLD_SCREEN_COPY = {
  title: "Hold date",
  whoLabel: "Customer",
  whenLabel: "When",
  stateLabel: "State",
  stateValue: "Provisional",
  action: "Hold provisionally",
  note: "The customer will be asked to confirm this date.",
} as const;
