import { describe, expect, it } from "vitest";
import {
  isUuid,
  mapAdminDeleteUserError,
  parseAdminDeleteUserRpcPayload,
} from "@/lib/admin/delete-user";

describe("admin delete user helpers", () => {
  it("validates UUIDs", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("3f1b0f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b")).toBe(true);
  });

  it("parses a successful RPC payload", () => {
    const result = parseAdminDeleteUserRpcPayload({
      ok: true,
      userId: "3f1b0f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      email: "test@example.com",
      deletedWorkspaces: 1,
      deletedStorageObjects: 2,
    });

    expect(result).toEqual({
      ok: true,
      userId: "3f1b0f6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      email: "test@example.com",
      deletedWorkspaces: 1,
      deletedStorageObjects: 2,
    });
  });

  it("rejects malformed RPC payloads", () => {
    expect(parseAdminDeleteUserRpcPayload(null).ok).toBe(false);
    expect(parseAdminDeleteUserRpcPayload({ ok: true }).ok).toBe(false);
  });

  it("maps prefixed SQL exceptions to structured errors", () => {
    expect(
      mapAdminDeleteUserError(
        "EMAIL_MISMATCH: confirm_email (a@x.com) does not match auth user email (b@x.com)."
      )
    ).toEqual({
      ok: false,
      code: "EMAIL_MISMATCH",
      error:
        "confirm_email (a@x.com) does not match auth user email (b@x.com).",
    });

    expect(
      mapAdminDeleteUserError(
        'FK_BLOCKED: Could not finish deleting user abc because related rows still reference auth.users. update or delete on table "workspaces" violates foreign key'
      ).code
    ).toBe("FK_BLOCKED");
  });

  it("falls back to RPC_ERROR for unknown messages", () => {
    expect(mapAdminDeleteUserError("something else")).toEqual({
      ok: false,
      code: "RPC_ERROR",
      error: "something else",
    });
  });
});
