"use client";

import { isDevTestingEnabledClient } from "@/lib/env/dev-testing";

export function DevTestingClientDebugLine() {
  return (
    <p className="qf-dev-debug-line">
      devTestingEnabled (client): {String(isDevTestingEnabledClient())}
    </p>
  );
}
