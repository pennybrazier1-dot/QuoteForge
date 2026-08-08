import { describe, expect, it } from "vitest";
import { decideSignedInAuthPageAccess } from "@/lib/auth/signed-in-auth-page";

describe("decideSignedInAuthPageAccess", () => {
  it("sends fully set-up users from /login to their app home", () => {
    expect(
      decideSignedInAuthPageAccess({
        pathname: "/login",
        homePath: "/dashboard",
      })
    ).toEqual({ kind: "redirect", path: "/dashboard" });
  });

  it("does not send incomplete sessions from /login to onboarding", () => {
    expect(
      decideSignedInAuthPageAccess({
        pathname: "/login",
        homePath: "/onboarding",
      })
    ).toEqual({ kind: "show_page", clearIncompleteSession: true });
  });

  it("continues incomplete signup from /signup into onboarding", () => {
    expect(
      decideSignedInAuthPageAccess({
        pathname: "/signup",
        homePath: "/onboarding",
      })
    ).toEqual({ kind: "redirect", path: "/onboarding" });
  });

  it("sends completed users away from /signup to the dashboard", () => {
    expect(
      decideSignedInAuthPageAccess({
        pathname: "/signup",
        homePath: "/dashboard",
      })
    ).toEqual({ kind: "redirect", path: "/dashboard" });
  });

  it("allows forgot-password when setup is incomplete", () => {
    expect(
      decideSignedInAuthPageAccess({
        pathname: "/forgot-password",
        homePath: "/onboarding",
      })
    ).toEqual({ kind: "show_page", clearIncompleteSession: false });
  });
});
