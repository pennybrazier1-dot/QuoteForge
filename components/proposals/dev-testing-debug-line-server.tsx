import { isDevTestingEnabled } from "@/lib/env/dev-testing";
import { DevTestingClientDebugLine } from "@/components/proposals/dev-testing-debug-line";

export function DevTestingDebugLine() {
  if (!isDevTestingEnabled()) {
    return null;
  }

  return (
    <div className="qf-dev-debug" aria-live="polite">
      <p className="qf-dev-debug-title">Preview debug (temporary)</p>
      <p className="qf-dev-debug-line">
        devTestingEnabled (server): {String(isDevTestingEnabled())}
      </p>
      <DevTestingClientDebugLine />
      <p className="qf-dev-debug-line">
        VERCEL_ENV: {process.env.VERCEL_ENV ?? "(not set)"}
      </p>
      <p className="qf-dev-debug-line">
        NEXT_PUBLIC_VERCEL_ENV:{" "}
        {process.env.NEXT_PUBLIC_VERCEL_ENV ?? "(not set)"}
      </p>
      <p className="qf-dev-debug-line">
        NEXT_PUBLIC_QF_DEV_TESTING:{" "}
        {process.env.NEXT_PUBLIC_QF_DEV_TESTING ?? "(not set)"}
      </p>
      <p className="qf-dev-debug-line">
        NODE_ENV: {process.env.NODE_ENV ?? "(not set)"}
      </p>
    </div>
  );
}
