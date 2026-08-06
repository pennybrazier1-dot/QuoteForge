export type AdminDeleteUserSuccess = {
  ok: true;
  userId: string;
  email: string;
  deletedWorkspaces: number;
  deletedStorageObjects: number;
};

export type AdminDeleteUserFailure = {
  ok: false;
  error: string;
  code?:
    | "USER_ID_REQUIRED"
    | "CONFIRM_EMAIL_REQUIRED"
    | "USER_NOT_FOUND"
    | "EMAIL_MISMATCH"
    | "AUTH_DELETE_FAILED"
    | "FK_BLOCKED"
    | "INVALID_USER_ID"
    | "SELF_DELETE_BLOCKED"
    | "NOT_CONFIGURED"
    | "RPC_ERROR";
};

export type AdminDeleteUserResult =
  | AdminDeleteUserSuccess
  | AdminDeleteUserFailure;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function parseAdminDeleteUserRpcPayload(
  payload: unknown
): AdminDeleteUserResult {
  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      code: "RPC_ERROR",
      error: "Admin delete returned an unexpected empty response.",
    };
  }

  const data = payload as Record<string, unknown>;
  if (data.ok !== true) {
    return {
      ok: false,
      code: "RPC_ERROR",
      error: "Admin delete did not confirm success.",
    };
  }

  const userId = typeof data.userId === "string" ? data.userId : "";
  const email = typeof data.email === "string" ? data.email : "";
  const deletedWorkspaces =
    typeof data.deletedWorkspaces === "number" ? data.deletedWorkspaces : 0;
  const deletedStorageObjects =
    typeof data.deletedStorageObjects === "number"
      ? data.deletedStorageObjects
      : 0;

  if (!userId || !email) {
    return {
      ok: false,
      code: "RPC_ERROR",
      error: "Admin delete response was missing user details.",
    };
  }

  return {
    ok: true,
    userId,
    email,
    deletedWorkspaces,
    deletedStorageObjects,
  };
}

/** Maps Postgres RAISE EXCEPTION prefixes to structured admin errors. */
export function mapAdminDeleteUserError(message: string): AdminDeleteUserFailure {
  const text = message.trim();
  const known = [
    "USER_ID_REQUIRED",
    "CONFIRM_EMAIL_REQUIRED",
    "USER_NOT_FOUND",
    "EMAIL_MISMATCH",
    "AUTH_DELETE_FAILED",
    "FK_BLOCKED",
  ] as const;

  for (const code of known) {
    if (text.startsWith(`${code}:`)) {
      return {
        ok: false,
        code,
        error: text.slice(code.length + 1).trim() || text,
      };
    }
    // supabase-js often wraps: '...' CONTEXT or includes the message mid-string
    const idx = text.indexOf(`${code}:`);
    if (idx >= 0) {
      return {
        ok: false,
        code,
        error: text.slice(idx + code.length + 1).trim() || text,
      };
    }
  }

  return {
    ok: false,
    code: "RPC_ERROR",
    error: text || "Admin delete failed for an unknown reason.",
  };
}
