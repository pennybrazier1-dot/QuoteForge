import { afterEach, describe, expect, it } from "vitest";
import {
  buildAdminTestUserRows,
  canSelectUserForDelete,
  emailsMatchForConfirm,
} from "@/lib/admin/test-users";

describe("admin test users helpers", () => {
  const originalAllowlist = process.env.PLATFORM_ADMIN_EMAILS;

  afterEach(() => {
    if (originalAllowlist === undefined) {
      delete process.env.PLATFORM_ADMIN_EMAILS;
    } else {
      process.env.PLATFORM_ADMIN_EMAILS = originalAllowlist;
    }
  });

  it("builds rows and attaches workspace info", () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;

    const rows = buildAdminTestUserRows(
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          email: "newer@example.com",
          created_at: "2026-08-06T12:00:00.000Z",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          email: "older@example.com",
          created_at: "2026-08-01T12:00:00.000Z",
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          email: null,
          created_at: "2026-08-05T12:00:00.000Z",
        },
      ],
      [
        {
          id: "ws-1",
          owner_id: "11111111-1111-4111-8111-111111111111",
          business_name: "Newer Plumbers",
        },
      ]
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.email).toBe("newer@example.com");
    expect(rows[0]?.hasWorkspace).toBe(true);
    expect(rows[0]?.businessName).toBe("Newer Plumbers");
    expect(rows[1]?.hasWorkspace).toBe(false);
  });

  it("marks allowlisted admins as protected", () => {
    process.env.PLATFORM_ADMIN_EMAILS = "owner@example.com";

    const rows = buildAdminTestUserRows(
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          email: "owner@example.com",
          created_at: "2026-08-06T12:00:00.000Z",
        },
      ],
      []
    );

    expect(rows[0]?.isProtectedAdmin).toBe(true);
    expect(
      canSelectUserForDelete(rows[0]!, "99999999-9999-4999-8999-999999999999")
    ).toBe(false);
  });

  it("blocks deleting the signed-in admin", () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;

    const rows = buildAdminTestUserRows(
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          email: "me@example.com",
          created_at: "2026-08-06T12:00:00.000Z",
        },
      ],
      []
    );

    expect(
      canSelectUserForDelete(rows[0]!, "11111111-1111-4111-8111-111111111111")
    ).toBe(false);
  });

  it("matches confirmation emails case-insensitively", () => {
    expect(emailsMatchForConfirm("Test@Example.com", "test@example.com")).toBe(
      true
    );
    expect(emailsMatchForConfirm("other@example.com", "test@example.com")).toBe(
      false
    );
  });
});
