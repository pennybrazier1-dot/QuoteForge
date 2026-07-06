/**
 * Run with: npx tsx scripts/verify-proposal-sanitize.mjs
 */
import { readFileSync } from "node:fs";
import { preserveQualifiedDuration } from "../lib/ai/qualifiers.ts";
import {
  sanitizeGeneratedProposal,
  sanitizeExtractedPrice,
  sanitizeEstimatedDuration,
} from "../lib/ai/sanitize-proposal.ts";
import {
  extractEstimatedPriceDigits,
  extractOptionalExtrasFromSiteNotes,
  extractDurationFromSiteNotes,
  looksLikeInvalidDuration,
  priceDigitsToPence,
} from "../lib/ai/extract-from-site-notes.ts";
import {
  refineJobSummary,
  refineOptionalExtras,
  refineScopeOfWork,
  professionalizeOptionalExtra,
} from "../lib/ai/refine-proposal-structure.ts";

const realisticSiteNotes = `Customer: Sarah Mitchell
Property: 42 Oak Avenue, Manchester M14 5RT
Phone: 07123 456789
Email: sarah.mitchell@example.com

Install kitchen units and a freestanding island with sink cut-out.
Materials: kitchen units, worktops, handles.
£3,000 estimate price.
Duration around one week.
Start week commencing 18th September.
optional extras could be under-cabinet lighting and extra sockets`;

const badAiProposal = {
  jobSummary: "Kitchen installation for Sarah Mitchell at 42 Oak Avenue.",
  scopeOfWork: [
    "Install kitchen units",
    "Install a freestanding kitchen island with a cut-out prepared for the sink",
    "Fit handles and complete final adjustments",
  ],
  materials: ["Kitchen units", "Worktops", "Handles"],
  labour: "around £3,000 for completing the job, expected to take a week",
  estimatedDuration: "42 Oak Avenue, Manchester M14 5RT",
  thingsToConfirm: [
    "Confirm optional extras could be extra sockets",
    "Confirm customer address",
  ],
  optionalExtras: [],
  paymentTerms: "50% deposit on acceptance",
  extractedCustomerName: "Sarah Mitchell",
  extractedPropertyAddress: "42 Oak Avenue, Manchester M14 5RT",
  extractedPhoneNumber: "07123 456789",
  extractedEmailAddress: "sarah.mitchell@example.com",
  extractedEstimatedPrice: "",
  plannedStartDate: "week commencing 18th September",
  plannedStartDateExact: "",
};

const failures = [];

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function assertLabourClean(labour, label) {
  assert(
    !/£|pound|week|duration|price|total|days?/i.test(labour),
    `${label}: labour still contains forbidden wording: ${labour}`
  );
  assert(
    labour.startsWith("Labour to"),
    `${label}: labour should be rebuilt from scope: ${labour}`
  );
}

// --- Realistic site notes extraction ---
assert(
  extractEstimatedPriceDigits(realisticSiteNotes) === "3000",
  `Price from realistic notes: expected 3000`
);
assert(
  priceDigitsToPence(extractEstimatedPriceDigits(realisticSiteNotes)) === 300000,
  `Price pence from realistic notes: expected 300000`
);

const realisticExtras = extractOptionalExtrasFromSiteNotes(realisticSiteNotes, []);
assert(realisticExtras.length >= 2, `Realistic optional extras: ${JSON.stringify(realisticExtras)}`);
assert(
  realisticExtras.some((item) => /under-cabinet lighting/i.test(item)),
  `Missing under-cabinet lighting: ${JSON.stringify(realisticExtras)}`
);
assert(
  realisticExtras.some((item) => /extra sockets/i.test(item)),
  `Missing extra sockets: ${JSON.stringify(realisticExtras)}`
);

const realisticDuration = extractDurationFromSiteNotes(realisticSiteNotes);
assert(
  /week/i.test(realisticDuration) && !/avenue|manchester|m14/i.test(realisticDuration),
  `Duration from notes should be time-only, got: ${realisticDuration}`
);

// --- Address bleeding: qualifier stage must not inject address into duration ---
const afterQualifiers = preserveQualifiedDuration(
  badAiProposal.estimatedDuration,
  realisticSiteNotes,
  null
);
assert(
  looksLikeInvalidDuration(afterQualifiers),
  `Qualifier stage should not fix bad duration (sanitizer does): got ${afterQualifiers}`
);
assert(
  /avenue|manchester|m14/i.test(afterQualifiers),
  `Address should still be in qualifier output before sanitize: ${afterQualifiers}`
);

// --- Full sanitize fixes field bleed ---
const sanitized = sanitizeGeneratedProposal(badAiProposal, realisticSiteNotes, null, null);

assert(
  sanitized.extractedCustomerName === "Sarah Mitchell",
  `Customer name: ${sanitized.extractedCustomerName}`
);
assert(
  sanitized.extractedPropertyAddress.includes("Oak Avenue"),
  `Property address: ${sanitized.extractedPropertyAddress}`
);
assert(
  sanitized.extractedPhoneNumber.includes("07123"),
  `Phone: ${sanitized.extractedPhoneNumber}`
);
assert(
  sanitized.extractedEmailAddress.includes("sarah.mitchell"),
  `Email: ${sanitized.extractedEmailAddress}`
);
assert(
  sanitized.extractedEstimatedPrice === "3000",
  `Price after sanitize: ${sanitized.extractedEstimatedPrice}`
);
assert(
  priceDigitsToPence(sanitized.extractedEstimatedPrice) === 300000,
  `Price pence after sanitize`
);
assert(
  !looksLikeInvalidDuration(sanitized.estimatedDuration),
  `Duration after sanitize must be valid, got: ${sanitized.estimatedDuration}`
);
assert(
  /week/i.test(sanitized.estimatedDuration),
  `Duration should mention week, got: ${sanitized.estimatedDuration}`
);
assert(
  !/avenue|manchester|m14|07123|@/i.test(sanitized.estimatedDuration),
  `Duration must not contain address/contact: ${sanitized.estimatedDuration}`
);
assert(
  sanitized.optionalExtras.length >= 2,
  `Optional extras after sanitize: ${JSON.stringify(sanitized.optionalExtras)}`
);
assert(
  sanitized.plannedStartDate.toLowerCase().includes("september"),
  `Planned start: ${sanitized.plannedStartDate}`
);
assertLabourClean(sanitized.labour, "Realistic case");
assert(
  !sanitized.thingsToConfirm.some((item) => /optional extra/i.test(item)),
  `Optional extras still in thingsToConfirm: ${JSON.stringify(sanitized.thingsToConfirm)}`
);
assert(
  !sanitized.thingsToConfirm.some((item) => /confirm customer address/i.test(item)),
  `Address confirmation should be removed: ${JSON.stringify(sanitized.thingsToConfirm)}`
);

// --- Isolated price + extras phrasing ---
const shortNotes =
  "Install kitchen units and island. £3,000 estimate price. optional extras could be under-cabinet lighting and extra sockets";

const shortAi = {
  ...badAiProposal,
  extractedCustomerName: "",
  extractedPropertyAddress: "",
  extractedPhoneNumber: "",
  extractedEmailAddress: "",
  estimatedDuration: "around one week",
  plannedStartDate: "",
};

const shortSanitized = sanitizeGeneratedProposal(shortAi, shortNotes, null, null);
assert(shortSanitized.extractedEstimatedPrice === "3000", `Short notes price`);
assert(shortSanitized.optionalExtras.length >= 2, `Short notes extras`);

// --- Duration sanitizer rejects address directly ---
const durationFixed = sanitizeEstimatedDuration(
  { ...badAiProposal, thingsToConfirm: [] },
  realisticSiteNotes,
  null
);
assert(
  !looksLikeInvalidDuration(durationFixed.estimatedDuration),
  `sanitizeEstimatedDuration: ${durationFixed.estimatedDuration}`
);
assert(
  durationFixed.thingsToConfirm.some((item) => /confirm estimated duration/i.test(item)) === false,
  `Should not need confirm when duration recovered from notes`
);

// --- Invalid AI price is replaced from notes ---
const badPrice = sanitizeExtractedPrice(
  { ...badAiProposal, extractedEstimatedPrice: "Oak Avenue" },
  realisticSiteNotes,
  null
);
assert(badPrice.extractedEstimatedPrice === "3000", `Bad AI price replaced: ${badPrice.extractedEstimatedPrice}`);

// --- Price phrasing variants ---
const pricePhrases = [
  ["£3,000 estimate price", "3000"],
  ["£3000", "3000"],
  ["3000 pounds", "3000"],
  ["around £3,000", "3000"],
  ["price about £3,000", "3000"],
  ["estimated at £3,000", "3000"],
  ["quote around £3,000", "3000"],
];

for (const [phrase, expected] of pricePhrases) {
  const got = extractEstimatedPriceDigits(phrase);
  assert(got === expected, `Price phrase "${phrase}": expected ${expected}, got ${got}`);
}

// --- Proposal structure refinement ---
const longSummary =
  "Kitchen refurbishment for the customer. Install new units and an island. Fit handles and complete adjustments. Remove old units.";
const concise = refineJobSummary(longSummary);
assert(
  splitSentences(concise).length <= 2,
  `Job summary should be at most 2 sentences, got: ${concise}`
);

const summary =
  "Kitchen refurbishment including new units and a freestanding island.";
const scope = refineScopeOfWork(
  [
    "Kitchen refurbishment including new units and a freestanding island.",
    "Install kitchen units",
    "Install a freestanding kitchen island with a cut-out prepared for the sink",
  ],
  summary
);
assert(
  scope.length === 2,
  `Scope should drop summary duplicate, got: ${JSON.stringify(scope)}`
);

const workflowScope = refineScopeOfWork(
  [
    "Protect work area",
    "Isolate water supply",
    "Remove existing suite",
    "Bathroom refurbishment with replacement suite",
    "Install new suite",
    "Test installation",
    "Leave work area clean",
  ],
  "Bathroom refurbishment with replacement suite."
);
assert(
  workflowScope.length >= 6,
  `Workflow scope tasks should be kept: ${JSON.stringify(workflowScope)}`
);
assert(
  workflowScope.some((item) => /protect work area/i.test(item)),
  `Workflow scope should keep preparation tasks`
);
assert(
  !workflowScope.some((item) =>
    /bathroom refurbishment with replacement suite/i.test(item)
  ),
  `Workflow scope should drop whole-job summary duplicate`
);

const doorExtra = professionalizeOptionalExtra("new replacement door, please");
assert(
  /supply and fit a replacement door/i.test(doorExtra) && !/please/i.test(doorExtra),
  `Optional extra should be professional: ${doorExtra}`
);

const refinedExtras = refineOptionalExtras([
  "under-cabinet lighting please",
  "extra sockets, thanks",
]);
assert(
  refinedExtras.every((item) => !/please|thanks/i.test(item)),
  `Conversational wording removed: ${JSON.stringify(refinedExtras)}`
);

// --- Labour: internal only, never customer-facing UI ---
assert(
  typeof sanitized.labour === "string" && sanitized.labour.trim().length > 0,
  "Internal labour should exist after sanitization"
);
assert(
  !readFileSync(
    new URL("../components/proposals/structured-proposal-content.tsx", import.meta.url),
    "utf8"
  ).includes("proposal.labour"),
  "Structured proposal content must not render proposal.labour"
);

if (failures.length > 0) {
  console.error("FAILED:");
  for (const failure of failures) {
    console.error(" -", failure);
  }
  process.exit(1);
}

console.log("PASSED proposal sanitization checks");
console.log("Duration:", sanitized.estimatedDuration);
console.log("Price:", sanitized.extractedEstimatedPrice);
console.log("Optional extras:", sanitized.optionalExtras);
console.log("Labour:", sanitized.labour);
