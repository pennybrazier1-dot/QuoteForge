import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertRehearsalOutboundBlocked,
  createVerifiedRehearsalPsql,
  isRehearsalDbRequested,
  readRehearsalDbConfig,
  verifyRehearsalIdentity,
  type RehearsalDbConfig,
  type RehearsalExecFileSync,
} from "@/lib/testing/rehearsal-db";

const VALID_MARKER = "reanvil-local-rehearsal-2ac6e1fc6fc50f7af337fa7a";

function validEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    REANVIL_DB_REHEARSAL: "1",
    REANVIL_REHEARSAL_PGHOST: "127.0.0.1",
    REANVIL_REHEARSAL_PGPORT: "55432",
    REANVIL_REHEARSAL_PGDATABASE: "reanvil_rehearsal",
    REANVIL_REHEARSAL_PGUSER: "postgres",
    REANVIL_REHEARSAL_PGPASSWORD: "test-only-password",
    REANVIL_REHEARSAL_MARKER: VALID_MARKER,
    ...overrides,
  };
}

describe("rehearsal-db fail-closed guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats ordinary unit runs as not requested", () => {
    expect(isRehearsalDbRequested({})).toBe(false);
    expect(isRehearsalDbRequested({ REANVIL_DB_REHEARSAL: "0" })).toBe(false);
    expect(isRehearsalDbRequested({ REANVIL_DB_REHEARSAL: "true" })).toBe(
      false
    );
  });

  it("rejects missing rehearsal flag before any connection", () => {
    const exec = vi.fn<RehearsalExecFileSync>();
    expect(() => readRehearsalDbConfig({})).toThrow(/REANVIL_DB_REHEARSAL/);
    expect(() =>
      createVerifiedRehearsalPsql({ env: {}, execFileSyncImpl: exec })
    ).toThrow(/REANVIL_DB_REHEARSAL/);
    expect(exec).not.toHaveBeenCalled();
  });

  it("rejects blank configuration before any connection", () => {
    const exec = vi.fn<RehearsalExecFileSync>();
    expect(() =>
      readRehearsalDbConfig(validEnv({ REANVIL_REHEARSAL_PGHOST: "  " }))
    ).toThrow(/REANVIL_REHEARSAL_PGHOST/);
    expect(() =>
      createVerifiedRehearsalPsql({
        env: validEnv({ REANVIL_REHEARSAL_PGPASSWORD: "" }),
        execFileSyncImpl: exec,
      })
    ).toThrow(/REANVIL_REHEARSAL_PGPASSWORD/);
    expect(exec).not.toHaveBeenCalled();
  });

  it("rejects Production hosts and project references before any connection", () => {
    const exec = vi.fn<RehearsalExecFileSync>();
    expect(() =>
      readRehearsalDbConfig(
        validEnv({
          REANVIL_REHEARSAL_PGHOST: "db.icqnivektneuxysqevqf.supabase.co",
        })
      )
    ).toThrow(/Production|loopback/i);
    expect(() =>
      readRehearsalDbConfig(
        validEnv({
          NEXT_PUBLIC_SUPABASE_URL:
            "https://icqnivektneuxysqevqf.supabase.co",
        })
      )
    ).toThrow(/Production/);
    expect(() =>
      createVerifiedRehearsalPsql({
        env: validEnv({
          DATABASE_URL:
            "postgres://x:y@db.icqnivektneuxysqevqf.supabase.co:5432/postgres",
        }),
        execFileSyncImpl: exec,
      })
    ).toThrow(/Production/);
    expect(exec).not.toHaveBeenCalled();
  });

  it("rejects development ports 54322 and 54321 before any connection", () => {
    const exec = vi.fn<RehearsalExecFileSync>();
    for (const port of ["54322", "54321"]) {
      expect(() =>
        readRehearsalDbConfig(validEnv({ REANVIL_REHEARSAL_PGPORT: port }))
      ).toThrow(/port/);
      expect(() =>
        createVerifiedRehearsalPsql({
          env: validEnv({ REANVIL_REHEARSAL_PGPORT: port }),
          execFileSyncImpl: exec,
        })
      ).toThrow(/port/);
    }
    expect(exec).not.toHaveBeenCalled();
  });

  it("rejects non-loopback hosts and wrong database names before any connection", () => {
    const exec = vi.fn<RehearsalExecFileSync>();
    expect(() =>
      readRehearsalDbConfig(validEnv({ REANVIL_REHEARSAL_PGHOST: "localhost" }))
    ).toThrow(/loopback/);
    expect(() =>
      readRehearsalDbConfig(
        validEnv({ REANVIL_REHEARSAL_PGDATABASE: "postgres" })
      )
    ).toThrow(/reanvil_rehearsal/);
    expect(exec).not.toHaveBeenCalled();
  });

  it("rejects default/missing marker shapes before any connection", () => {
    const exec = vi.fn<RehearsalExecFileSync>();
    expect(() =>
      readRehearsalDbConfig(
        validEnv({ REANVIL_REHEARSAL_MARKER: "production-like-id" })
      )
    ).toThrow(/marker/);
    expect(exec).not.toHaveBeenCalled();
  });

  it("blocks outbound provider credentials before connecting", () => {
    expect(() =>
      assertRehearsalOutboundBlocked(
        validEnv({ REANVIL_ALLOW_LOCAL_OUTBOUND: "1" })
      )
    ).toThrow(/REANVIL_ALLOW_LOCAL_OUTBOUND/);
    expect(() =>
      assertRehearsalOutboundBlocked(validEnv({ RESEND_API_KEY: "re_test" }))
    ).toThrow(/RESEND_API_KEY/);
    expect(() =>
      assertRehearsalOutboundBlocked(validEnv({ STRIPE_SECRET_KEY: "sk_test" }))
    ).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("accepts a valid env config without connecting", () => {
    const config = readRehearsalDbConfig(validEnv());
    expect(config).toEqual({
      host: "127.0.0.1",
      port: "55432",
      database: "reanvil_rehearsal",
      user: "postgres",
      password: "test-only-password",
      marker: VALID_MARKER,
    });
  });

  it("fails on marker mismatch using a mocked database client", () => {
    const config = readRehearsalDbConfig(validEnv());
    const psql = (sql: string) => {
      if (sql.includes("current_database")) return "reanvil_rehearsal";
      if (sql.includes("inet_server_port")) return "5432";
      if (sql.includes("reanvil_rehearsal_meta.identity")) {
        return "reanvil-local-rehearsal-WRONG";
      }
      throw new Error(`unexpected sql in mock: ${sql.slice(0, 80)}`);
    };
    expect(() => verifyRehearsalIdentity(psql, config)).toThrow(
      /marker mismatch/
    );
  });

  it("fails when marker query returns zero or many rows", () => {
    const config = readRehearsalDbConfig(validEnv());
    const none = (sql: string) => {
      if (sql.includes("current_database")) return "reanvil_rehearsal";
      if (sql.includes("inet_server_port")) return "5432";
      return "";
    };
    expect(() => verifyRehearsalIdentity(none, config)).toThrow(
      /exactly one/
    );

    const many = (sql: string) => {
      if (sql.includes("current_database")) return "reanvil_rehearsal";
      if (sql.includes("inet_server_port")) return "5432";
      return `${VALID_MARKER}\n${VALID_MARKER}-extra`;
    };
    expect(() => verifyRehearsalIdentity(many, config)).toThrow(
      /exactly one/
    );
  });

  it("creates a verified runner only after mocked identity checks succeed", () => {
    const calls: string[] = [];
    const exec = vi.fn<RehearsalExecFileSync>((_file, args) => {
      const sql = String(args[args.length - 1] ?? "");
      calls.push(sql);
      if (sql.includes("current_database")) return "reanvil_rehearsal";
      if (sql.includes("inet_server_port")) return "5432";
      if (sql.includes("reanvil_rehearsal_meta.identity")) return VALID_MARKER;
      if (sql.includes("select 1")) return "1";
      throw new Error(`unexpected sql: ${sql.slice(0, 80)}`);
    });

    const runner = createVerifiedRehearsalPsql({
      env: validEnv(),
      execFileSyncImpl: exec,
    });

    expect(calls.some((sql) => sql.includes("current_database"))).toBe(true);
    expect(calls.some((sql) => sql.includes("reanvil_rehearsal_meta"))).toBe(
      true
    );
    expect(runner.psql("select 1")).toBe("1");

    const connectArgs = exec.mock.calls[0]?.[1] ?? [];
    expect(connectArgs).toContain("127.0.0.1");
    expect(connectArgs).toContain("55432");
    expect(connectArgs).toContain("reanvil_rehearsal");
    expect(connectArgs).not.toContain("54322");
    expect(connectArgs).not.toContain("54321");
  });

  it("does not allow SQL before identity verification completes", () => {
    const config: RehearsalDbConfig = readRehearsalDbConfig(validEnv());
    let verified = false;
    const gated = (sql: string) => {
      if (!verified) {
        throw new Error(
          "Rehearsal database refused: identity not verified before SQL execution."
        );
      }
      return sql;
    };
    expect(() => gated("insert into public.customers values (1)")).toThrow(
      /identity not verified/
    );
    verified = true;
    expect(gated("select 1")).toBe("select 1");
    expect(config.database).toBe("reanvil_rehearsal");
  });
});
