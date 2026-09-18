import type { JobPrepItemStatus } from "@/lib/jobs/prep-items";

export const PREP_UPDATE_ERROR = "Could not update. Try again.";

export type OptimisticPrepState = {
  overrides: Record<string, JobPrepItemStatus>;
  pendingIds: string[];
  error: string | null;
};

export function emptyOptimisticPrepState(): OptimisticPrepState {
  return {
    overrides: {},
    pendingIds: [],
    error: null,
  };
}

export function canQueuePrepUpdate(
  state: OptimisticPrepState,
  itemId: string
): boolean {
  return Boolean(itemId) && !state.pendingIds.includes(itemId);
}

/** Apply the visible tick immediately. Does not wait for the server. */
export function beginPrepStatusUpdate(
  state: OptimisticPrepState,
  itemId: string,
  status: JobPrepItemStatus
): OptimisticPrepState {
  if (!canQueuePrepUpdate(state, itemId)) {
    return state;
  }

  return {
    overrides: {
      ...state.overrides,
      [itemId]: status,
    },
    pendingIds: [...state.pendingIds, itemId],
    error: null,
  };
}

export function completePrepStatusUpdate(
  state: OptimisticPrepState,
  itemId: string
): OptimisticPrepState {
  return {
    ...state,
    pendingIds: state.pendingIds.filter((id) => id !== itemId),
  };
}

export function failPrepStatusUpdate(
  state: OptimisticPrepState,
  itemId: string
): OptimisticPrepState {
  const overrides = { ...state.overrides };
  delete overrides[itemId];
  return {
    overrides,
    pendingIds: state.pendingIds.filter((id) => id !== itemId),
    error: PREP_UPDATE_ERROR,
  };
}

export function applyPrepStatusOverrides<
  T extends { id: string; status: JobPrepItemStatus },
>(items: T[], overrides: Record<string, JobPrepItemStatus>): T[] {
  if (Object.keys(overrides).length === 0) {
    return items;
  }

  return items.map((item) => {
    const nextStatus = overrides[item.id];
    return nextStatus ? { ...item, status: nextStatus } : item;
  });
}

/** Drop overrides that the server has already caught up with. */
export function reconcilePrepOverrides(
  overrides: Record<string, JobPrepItemStatus>,
  items: Array<{ id: string; status: JobPrepItemStatus }>
): Record<string, JobPrepItemStatus> {
  const next = { ...overrides };
  for (const item of items) {
    if (next[item.id] === item.status) {
      delete next[item.id];
    }
  }
  return next;
}

export function isPrepRowPending(
  pendingIds: string[],
  itemId: string
): boolean {
  return pendingIds.includes(itemId);
}
