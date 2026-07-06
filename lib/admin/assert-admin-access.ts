import { redirect } from "next/navigation";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";

/**
 * Temporary gate for the internal /admin area.
 * Available in local dev and Vercel preview — not on production.
 */
export function assertAdminAccess(): void {
  if (!isDevTestingEnabled()) {
    redirect("/dashboard");
  }
}
