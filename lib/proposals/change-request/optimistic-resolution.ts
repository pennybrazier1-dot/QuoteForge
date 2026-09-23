export const RESOLUTION_DISMISS_EVENT = "proposal-attention-resolved";
export const RESOLUTION_RESTORE_EVENT = "proposal-attention-restore";
export const RESOLUTION_ACCEPTED_EVENT = "proposal-requested-date-accepted";

export type AcceptedRequestedSlotDetail = {
  label: string;
  booked: boolean;
};

export type OptimisticResolutionState = {
  dismissed: boolean;
  pending: boolean;
  error: string | null;
};

export function emptyOptimisticResolutionState(): OptimisticResolutionState {
  return {
    dismissed: false,
    pending: false,
    error: null,
  };
}

/** Hide the action immediately. Persist in the background. */
export function beginResolutionDismiss(
  state: OptimisticResolutionState
): OptimisticResolutionState {
  if (state.pending || state.dismissed) {
    return state;
  }
  return {
    dismissed: true,
    pending: true,
    error: null,
  };
}

export function completeResolutionDismiss(
  state: OptimisticResolutionState
): OptimisticResolutionState {
  return {
    ...state,
    pending: false,
    dismissed: true,
    error: null,
  };
}

export function failResolutionDismiss(
  state: OptimisticResolutionState,
  error: string
): OptimisticResolutionState {
  return {
    dismissed: false,
    pending: false,
    error,
  };
}

export function visibleResolutionSummary<T>(
  summary: T | null | undefined,
  dismissed: boolean
): T | null {
  if (!summary || dismissed) {
    return null;
  }
  return summary;
}

export function dispatchResolutionDismissed(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(RESOLUTION_DISMISS_EVENT));
}

export function dispatchResolutionRestored(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(RESOLUTION_RESTORE_EVENT));
}

export function dispatchResolutionAccepted(
  detail: AcceptedRequestedSlotDetail
): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<AcceptedRequestedSlotDetail>(RESOLUTION_ACCEPTED_EVENT, {
      detail,
    })
  );
}
