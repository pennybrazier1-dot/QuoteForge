import type { PostAuthPath } from "@/lib/onboarding/status";

export type SignedInAuthPageDecision =
  | { kind: "show_page"; clearIncompleteSession: boolean }
  | { kind: "redirect"; path: PostAuthPath };

/**
 * Separates "already signed in" from "finished onboarding".
 *
 * Visiting Login must never dump an incomplete session onto /onboarding —
 * that path is only for post-signup setup (or app routes that need a profile).
 */
export function decideSignedInAuthPageAccess(input: {
  pathname: string;
  homePath: PostAuthPath;
}): SignedInAuthPageDecision | null {
  const { pathname, homePath } = input;
  const setupComplete = homePath !== "/onboarding";

  if (pathname === "/login") {
    if (setupComplete) {
      return { kind: "redirect", path: homePath };
    }
    // Session exists but trader setup is incomplete: show the login form
    // (and clear the session) so Login → email/password works.
    return { kind: "show_page", clearIncompleteSession: true };
  }

  if (pathname === "/forgot-password") {
    if (setupComplete) {
      return { kind: "redirect", path: homePath };
    }
    return { kind: "show_page", clearIncompleteSession: false };
  }

  if (pathname === "/signup" || pathname === "/check-email") {
    // Finished users leave auth pages; new/incomplete users continue setup.
    return { kind: "redirect", path: homePath };
  }

  return null;
}
