#!/usr/bin/env node
/**
 * Stage 1J: refuse to run the app if env still points at production.
 * Prints hosts/ports only — never secret values.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PROD_REF = "icqnivektneuxysqevqf";
const PROD_HOST = `${PROD_REF}.supabase.co`;
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost"]);

function parseEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const envPath = resolve(process.cwd(), ".env.local");
// Prefer .env.local file for isolation proof. Also flag shell overrides that
// could accidentally reconnect the Next.js process to production.
const fileEnv = parseEnv(envPath);
const shellUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const url = fileEnv.NEXT_PUBLIC_SUPABASE_URL || "";
let host = "";
try {
  host = new URL(url).hostname;
} catch {
  console.error("FAIL: .env.local NEXT_PUBLIC_SUPABASE_URL is missing or invalid");
  process.exit(1);
}

const failures = [];
if (host.includes(PROD_REF) || host === PROD_HOST) {
  failures.push(`.env.local production host detected: ${host}`);
}
if (!ALLOWED_HOSTS.has(host)) {
  failures.push(`.env.local host must be localhost/127.0.0.1, got: ${host}`);
}
if ((fileEnv.RESEND_API_KEY || "").trim()) {
  failures.push(".env.local RESEND_API_KEY must be empty for local invoice testing");
}
if ((fileEnv.STRIPE_SECRET_KEY || fileEnv.STRIPE_SECRET || "").trim()) {
  failures.push(".env.local Stripe secret must be unset for local invoice testing");
}
if (shellUrl) {
  try {
    const shellHost = new URL(shellUrl).hostname;
    if (shellHost.includes(PROD_REF) || shellHost === PROD_HOST) {
      failures.push(
        `shell NEXT_PUBLIC_SUPABASE_URL still points at production (${shellHost}) — unset it before npm run dev`
      );
    }
  } catch {
    failures.push("shell NEXT_PUBLIC_SUPABASE_URL is set but invalid");
  }
}
if (existsSync(resolve(process.cwd(), "supabase/.temp/project-ref"))) {
  const ref = readFileSync(resolve(process.cwd(), "supabase/.temp/project-ref"), "utf8").trim();
  if (ref === PROD_REF) {
    failures.push("supabase/.temp/project-ref still linked to production");
  }
}

console.log("Local env check:");
console.log(`  .env.local NEXT_PUBLIC_SUPABASE_URL host = ${host}`);
console.log(`  .env.local NEXT_PUBLIC_SITE_URL = ${fileEnv.NEXT_PUBLIC_SITE_URL || "(default)"}`);
console.log(`  .env.local RESEND_API_KEY set = ${Boolean((fileEnv.RESEND_API_KEY || "").trim())}`);
console.log(
  `  .env.local SUPABASE_SERVICE_ROLE_KEY set = ${Boolean((fileEnv.SUPABASE_SERVICE_ROLE_KEY || "").trim())}`
);
console.log(
  `  shell NEXT_PUBLIC_SUPABASE_URL host = ${shellUrl ? new URL(shellUrl).hostname : "(unset)"}`
);

if (failures.length) {
  console.error("FAIL:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("PASS: local isolation OK");
