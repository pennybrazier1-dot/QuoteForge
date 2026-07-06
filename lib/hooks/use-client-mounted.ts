"use client";

import { useSyncExternalStore } from "react";

export function useClientMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
