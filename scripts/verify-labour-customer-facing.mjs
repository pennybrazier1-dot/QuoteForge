/**
 * Run with: npx tsx scripts/verify-labour-customer-facing.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeGeneratedProposal } from "../lib/ai/sanitize-proposal.ts";
import {
  CUSTOMER_FACING_PROPOSAL_FILES,
  findLabourInCustomerFacingSource,
} from "../lib/proposals/customer-facing-labour.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

for (const relativePath of CUSTOMER_FACING_PROPOSAL_FILES) {
  const absolutePath = join(root, relativePath);
  const source = readFileSync(absolutePath, "utf8");
  const match = findLabourInCustomerFacingSource(source);

  assert(
    !match,
    `${relativePath} still exposes labour to customers (matched ${match})`
  );
}

const siteNotes =
  "Install kitchen units. £3,000 estimate price. Duration around one week.";

const aiProposal = {
  jobSummary: "Kitchen installation work.",
  scopeOfWork: ["Install kitchen units", "Fit handles and complete final adjustments."],
  materials: ["Kitchen units"],
  labour: "around £3,000 for completing the job, expected to take a week",
  estimatedDuration: "around one week",
  thingsToConfirm: [],
  optionalExtras: [],
  paymentTerms: "50% deposit on acceptance",
  extractedCustomerName: "",
  extractedPropertyAddress: "",
  extractedPhoneNumber: "",
  extractedEmailAddress: "",
  extractedEstimatedPrice: "",
  plannedStartDate: "",
  plannedStartDateExact: "",
};

const sanitized = sanitizeGeneratedProposal(aiProposal, siteNotes, null, null);

assert(
  typeof sanitized.labour === "string" && sanitized.labour.trim().length > 0,
  "Internal labour should still be populated after sanitization"
);
assert(
  sanitized.labour.startsWith("Labour to"),
  `Internal labour should be rebuilt from scope: ${sanitized.labour}`
);

const structuredSource = readFileSync(
  join(root, "components/proposals/structured-proposal-content.tsx"),
  "utf8"
);
assert(
  !structuredSource.includes("proposal.labour"),
  "Structured proposal content must not read proposal.labour"
);

if (failures.length > 0) {
  console.error("FAILED labour customer-facing checks:");
  for (const failure of failures) {
    console.error(" -", failure);
  }
  process.exit(1);
}

console.log("PASSED labour customer-facing checks");
console.log("Internal labour preserved:", sanitized.labour);
