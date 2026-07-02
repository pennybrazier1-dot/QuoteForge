/**
 * Run with: node --input-type=module scripts/verify-proposal-sanitize.mjs
 */
import {
  sanitizeGeneratedProposal,
  sanitizeLabour,
  sanitizeOptionalExtras,
} from "../lib/ai/sanitize-proposal.ts";

const siteNotes =
  "Install kitchen units and island. total price around £3,000, duration around one week, optional extras could be extra sockets and under-cabinet lighting";

const aiProposal = {
  jobSummary: "Kitchen installation work.",
  scopeOfWork: [
    "Install kitchen units",
    "Install a freestanding kitchen island with a cut-out prepared for the sink",
    "Fit handles and complete final adjustments",
  ],
  materials: ["Kitchen units", "Island unit"],
  labour: "around £3,000 for completing the job, expected to take a week",
  estimatedDuration: "around one week",
  thingsToConfirm: ["Confirm optional extras could be extra sockets"],
  optionalExtras: [],
  paymentTerms: "50% deposit on acceptance",
  extractedCustomerName: "",
  extractedPropertyAddress: "",
  extractedPhoneNumber: "",
  extractedEmailAddress: "",
  extractedEstimatedPrice: "3000",
  plannedStartDate: "",
  plannedStartDateExact: "",
};

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const labour = sanitizeLabour(aiProposal);
assert(
  !/£|pound|week|duration|price|total/i.test(labour),
  `Labour still contains forbidden wording: ${labour}`
);
assert(
  labour.startsWith("Labour to"),
  `Labour should be rebuilt from scope: ${labour}`
);

const extras = sanitizeOptionalExtras(aiProposal.optionalExtras, siteNotes);
assert(extras.length >= 2, `Expected optional extras from site notes, got: ${JSON.stringify(extras)}`);
assert(
  extras.some((item) => /socket/i.test(item)),
  `Expected sockets in optional extras: ${JSON.stringify(extras)}`
);

const sanitized = sanitizeGeneratedProposal(aiProposal, siteNotes);
assert(
  !/£|pound|week|duration|price|total/i.test(sanitized.labour),
  `Sanitized labour still wrong: ${sanitized.labour}`
);
assert(
  sanitized.optionalExtras.length >= 2,
  `Sanitized optional extras missing: ${JSON.stringify(sanitized.optionalExtras)}`
);
assert(
  !sanitized.thingsToConfirm.some((item) => /optional extra/i.test(item)),
  `Optional extras still in thingsToConfirm: ${JSON.stringify(sanitized.thingsToConfirm)}`
);

if (failures.length > 0) {
  console.error("FAILED:");
  for (const failure of failures) {
    console.error(" -", failure);
  }
  process.exit(1);
}

console.log("PASSED proposal sanitization checks");
console.log("Labour:", sanitized.labour);
console.log("Optional extras:", sanitized.optionalExtras);
console.log("Estimated duration (unchanged):", sanitized.estimatedDuration);
console.log("Price field (unchanged):", sanitized.extractedEstimatedPrice);
