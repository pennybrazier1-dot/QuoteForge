#!/usr/bin/env node
/**
 * Stage 2C — shared local safety gate.
 * Refuses anything that is not local Supabase with empty Resend/Stripe.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const PROD_REF = "icqnivektneuxysqevqf";
export const BASE = "http://127.0.0.1:3000";
export const TRADER_EMAIL = "alex.morgan@morgan-home.test";
export const TRADER_PASSWORD = "LocalTest-Alex-2026!";
export const MARKER = "STAGE 2C WORKING-WEEK — FICTIONAL";

export function parseEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

export function loadLocalEnv() {
  return parseEnv(resolve(process.cwd(), ".env.local"));
}

export function assertLocalSafetyOrExit() {
  const assert = spawnSync("node", ["scripts/assert-local-env.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  process.stdout.write(assert.stdout || "");
  process.stderr.write(assert.stderr || "");
  if (assert.status !== 0) {
    console.error("REFUSE: assert-local-env failed");
    process.exit(1);
  }

  const env = loadLocalEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
    console.error("REFUSE: Supabase URL is not local");
    process.exit(1);
  }
  if (url.includes(PROD_REF)) {
    console.error("REFUSE: production Supabase ref in URL");
    process.exit(1);
  }
  if ((env.RESEND_API_KEY || "").trim()) {
    console.error("REFUSE: RESEND_API_KEY must be empty");
    process.exit(1);
  }
  if ((env.STRIPE_SECRET_KEY || env.STRIPE_SECRET || "").trim()) {
    console.error("REFUSE: Stripe secret must be unset");
    process.exit(1);
  }

  // Live local stack check
  try {
    const res = spawnSync(
      "curl",
      ["-s", "-o", "/dev/null", "-w", "%{http_code}", "http://127.0.0.1:54321/auth/v1/health"],
      { encoding: "utf8" }
    );
    if ((res.stdout || "").trim() !== "200") {
      console.error("REFUSE: local Supabase auth health is not 200");
      process.exit(1);
    }
  } catch {
    console.error("REFUSE: could not reach local Supabase");
    process.exit(1);
  }

  console.log("SAFE: local Supabase, empty Resend, empty Stripe, assert-local-env OK");
  return env;
}
