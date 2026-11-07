/**
 * Test-only fail-closed guard for disposable database rehearsal.
 * Ordinary unit runs must never connect. Rehearsal runs require explicit env,
 * loopback-only target, and a verified identity marker before any write.
 */

import { execFileSync } from "node:child_process";

export const REANVIL_PRODUCTION_SUPABASE_REF = "icqnivektneuxysqevqf";

export const REHEARSAL_ALLOWED_HOST = "127.0.0.1";
export const REHEARSAL_ALLOWED_PORT = "55432";
export const REHEARSAL_ALLOWED_DATABASE = "reanvil_rehearsal";

const FORBIDDEN_PORTS = new Set(["54321", "54322"]);

export type RehearsalDbConfig = {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  marker: string;
};

export type RehearsalPsqlRunner = {
  config: RehearsalDbConfig;
  psql: (sql: string) => string;
};

/** Loose env map so unit tests can pass plain objects without NODE_ENV. */
export type EnvLike = Record<string, string | undefined>;

export type RehearsalExecFileSync = (
  file: string,
  args: readonly string[],
  options: {
    encoding: "utf8";
    env: EnvLike;
    timeout: number;
  }
) => string;

function readRequiredEnv(env: EnvLike, key: string): string {
  const value = env[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `Rehearsal database refused: missing or blank ${key}.`
    );
  }
  return value.trim();
}

function rejectIfLooksLikeProduction(value: string, label: string): void {
  const lower = value.toLowerCase();
  if (
    lower.includes("supabase.co") ||
    lower.includes(REANVIL_PRODUCTION_SUPABASE_REF)
  ) {
    throw new Error(
      `Rehearsal database refused: ${label} looks like Production.`
    );
  }
}

/**
 * True only when the suite is deliberately invoked for disposable rehearsal.
 * Ordinary unit-test runs leave this unset and must skip without connecting.
 */
export function isRehearsalDbRequested(env: EnvLike = process.env): boolean {
  return env.REANVIL_DB_REHEARSAL === "1";
}

/**
 * Read and validate rehearsal connection settings from the environment.
 * Does not open a database connection.
 */
export function readRehearsalDbConfig(env: EnvLike = process.env): RehearsalDbConfig {
  if (!isRehearsalDbRequested(env)) {
    throw new Error(
      "Rehearsal database refused: REANVIL_DB_REHEARSAL must be exactly 1."
    );
  }

  const host = readRequiredEnv(env, "REANVIL_REHEARSAL_PGHOST");
  const port = readRequiredEnv(env, "REANVIL_REHEARSAL_PGPORT");
  const database = readRequiredEnv(env, "REANVIL_REHEARSAL_PGDATABASE");
  const user = readRequiredEnv(env, "REANVIL_REHEARSAL_PGUSER");
  const password = readRequiredEnv(env, "REANVIL_REHEARSAL_PGPASSWORD");
  const marker = readRequiredEnv(env, "REANVIL_REHEARSAL_MARKER");

  rejectIfLooksLikeProduction(host, "host");
  rejectIfLooksLikeProduction(database, "database");
  rejectIfLooksLikeProduction(user, "user");
  rejectIfLooksLikeProduction(marker, "marker");
  rejectIfLooksLikeProduction(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    "NEXT_PUBLIC_SUPABASE_URL"
  );
  rejectIfLooksLikeProduction(
    env.SUPABASE_URL ?? "",
    "SUPABASE_URL"
  );
  rejectIfLooksLikeProduction(
    env.DATABASE_URL ?? "",
    "DATABASE_URL"
  );

  if (host !== REHEARSAL_ALLOWED_HOST) {
    throw new Error(
      "Rehearsal database refused: host must be the authorised loopback address."
    );
  }
  if (FORBIDDEN_PORTS.has(port) || port !== REHEARSAL_ALLOWED_PORT) {
    throw new Error(
      "Rehearsal database refused: port is not the authorised disposable port."
    );
  }
  if (database !== REHEARSAL_ALLOWED_DATABASE) {
    throw new Error(
      "Rehearsal database refused: database name is not reanvil_rehearsal."
    );
  }
  if (!marker.startsWith("reanvil-local-rehearsal-")) {
    throw new Error(
      "Rehearsal database refused: marker is not a disposable local rehearsal identity."
    );
  }

  return { host, port, database, user, password, marker };
}

/**
 * Block accidental real outbound during rehearsal harness setup.
 * Does not print secrets.
 */
export function assertRehearsalOutboundBlocked(env: EnvLike = process.env): void {
  if (env.REANVIL_ALLOW_LOCAL_OUTBOUND === "1") {
    throw new Error(
      "Rehearsal database refused: REANVIL_ALLOW_LOCAL_OUTBOUND must not be enabled."
    );
  }
  const resend = env.RESEND_API_KEY?.trim();
  if (resend) {
    throw new Error(
      "Rehearsal database refused: RESEND_API_KEY must not be set for SQL integration tests."
    );
  }
  for (const key of [
    "TWILIO_AUTH_TOKEN",
    "TWILIO_ACCOUNT_SID",
    "STRIPE_SECRET_KEY",
    "OPENAI_API_KEY",
  ] as const) {
    if (env[key]?.trim()) {
      throw new Error(
        `Rehearsal database refused: ${key} must not be set for SQL integration tests.`
      );
    }
  }
}

/**
 * Read-only identity check. Must run before fixtures, cleanup, or migrations.
 * Does not create or modify the marker.
 */
export function verifyRehearsalIdentity(
  psql: (sql: string) => string,
  config: RehearsalDbConfig
): void {
  const database = psql("select current_database();");
  if (database !== REHEARSAL_ALLOWED_DATABASE) {
    throw new Error(
      "Rehearsal database refused: current_database() is not reanvil_rehearsal."
    );
  }

  const port = psql("select inet_server_port()::text;");
  // Inside Docker the server listens on 5432; the authorised host publish is 55432.
  if (port !== "5432" && port !== REHEARSAL_ALLOWED_PORT) {
    throw new Error(
      "Rehearsal database refused: server port does not match the disposable target."
    );
  }

  const rows = psql(`
    select marker
    from reanvil_rehearsal_meta.identity
    where purpose = 'disposable local migration rehearsal only'
      and host_port = 55432
      and container_name = 'reanvil_migration_rehearsal'
    order by marker;
  `);
  const markers = rows
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (markers.length !== 1) {
    throw new Error(
      "Rehearsal database refused: identity marker query did not return exactly one row."
    );
  }
  if (markers[0] !== config.marker) {
    throw new Error(
      "Rehearsal database refused: identity marker mismatch."
    );
  }
}

/**
 * Build a psql runner only after env validation, outbound block, and identity check.
 */
export function createVerifiedRehearsalPsql(options?: {
  env?: EnvLike;
  execFileSyncImpl?: RehearsalExecFileSync;
  timeoutMs?: number;
}): RehearsalPsqlRunner {
  const env = options?.env ?? process.env;
  const execImpl =
    options?.execFileSyncImpl ??
    (execFileSync as unknown as RehearsalExecFileSync);
  const timeoutMs = options?.timeoutMs ?? 30000;

  assertRehearsalOutboundBlocked(env);
  const config = readRehearsalDbConfig(env);

  let identityVerified = false;

  const psql = (sql: string): string => {
    if (!identityVerified) {
      throw new Error(
        "Rehearsal database refused: identity not verified before SQL execution."
      );
    }
    return runPsql(execImpl, config, env, sql, timeoutMs);
  };

  const verifyPsql = (sql: string): string =>
    runPsql(execImpl, config, env, sql, timeoutMs);

  verifyRehearsalIdentity(verifyPsql, config);
  identityVerified = true;

  return { config, psql };
}

function runPsql(
  execImpl: RehearsalExecFileSync,
  config: RehearsalDbConfig,
  env: EnvLike,
  sql: string,
  timeoutMs: number
): string {
  return execImpl(
    "psql",
    [
      "-h",
      config.host,
      "-p",
      config.port,
      "-U",
      config.user,
      "-d",
      config.database,
      "-v",
      "ON_ERROR_STOP=1",
      "-t",
      "-A",
      "-c",
      sql,
    ],
    {
      encoding: "utf8",
      env: {
        ...env,
        PGPASSWORD: config.password,
        // Prevent libpq from picking up a default DATABASE_URL / PG* fallback.
        PGHOST: config.host,
        PGPORT: config.port,
        PGDATABASE: config.database,
        PGUSER: config.user,
      },
      timeout: timeoutMs,
    }
  ).trim();
}

/**
 * Vitest helper: skip when rehearsal is not requested; fail closed when it is.
 */
export function describeRehearsalDb(
  name: string,
  suite: (getPsql: () => (sql: string) => string) => void,
  vitest: {
    describe: typeof import("vitest").describe;
    beforeAll: typeof import("vitest").beforeAll;
  }
): void {
  if (!isRehearsalDbRequested()) {
    vitest.describe.skip(name, () => {
      suite(() => {
        throw new Error(
          "Rehearsal database refused: suite skipped; no database connection."
        );
      });
    });
    return;
  }

  vitest.describe(name, () => {
    let runner: RehearsalPsqlRunner | undefined;

    vitest.beforeAll(() => {
      runner = createVerifiedRehearsalPsql();
    });

    suite(() => {
      if (!runner) {
        throw new Error(
          "Rehearsal database refused: connection was not verified in beforeAll."
        );
      }
      return runner.psql;
    });
  });
}
