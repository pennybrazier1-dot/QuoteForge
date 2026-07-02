/**
 * Run with: npx tsx scripts/verify-optional-extras-bathroom.mjs
 */
import { sanitizeGeneratedProposal } from "../lib/ai/sanitize-proposal.ts";
import { sanitizeOptionalExtras } from "../lib/ai/sanitize-proposal.ts";

const BATHROOM_SITE_NOTES =
  "Remove old bathroom suite and install new shower, bath, sink and toilet. Estimated price £3,000. Duration around one week. Planned start date 2nd June. Optional extras could be a replacement bathroom door and heated towel rail.";

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const aiProposalEmptyExtras = {
  jobSummary: "Bathroom refurbishment.",
  scopeOfWork: [
    "Remove old bathroom suite",
    "Install new shower, bath, sink and toilet",
  ],
  materials: ["Shower", "Bath", "Sink", "Toilet"],
  labour: "Labour to complete bathroom installation.",
  estimatedDuration: "around one week",
  thingsToConfirm: [],
  optionalExtras: [],
  paymentTerms: "50% deposit",
  extractedCustomerName: "",
  extractedPropertyAddress: "",
  extractedPhoneNumber: "",
  extractedEmailAddress: "",
  extractedEstimatedPrice: "",
  plannedStartDate: "2nd June",
  plannedStartDateExact: "",
};

const aiProposalCombinedExtra = {
  ...aiProposalEmptyExtras,
  optionalExtras: [
    "a replacement bathroom door and heated towel rail",
  ],
  thingsToConfirm: [
    "Confirm optional extras could be a replacement bathroom door",
  ],
};

function assertExtras(extras, label) {
  assert(extras.length >= 2, `${label}: expected 2 extras, got ${JSON.stringify(extras)}`);
  assert(
    extras.some((item) => /replacement bathroom door/i.test(item)),
    `${label}: missing bathroom door -> ${JSON.stringify(extras)}`
  );
  assert(
    extras.some((item) => /heated towel rail/i.test(item)),
    `${label}: missing heated towel rail -> ${JSON.stringify(extras)}`
  );
  assert(
    extras.some((item) => /supply and fit a replacement bathroom door/i.test(item)),
    `${label}: door should use supply and fit -> ${JSON.stringify(extras)}`
  );
  assert(
    extras.some((item) => /supply and install a heated towel rail/i.test(item)),
    `${label}: towel rail should use supply and install -> ${JSON.stringify(extras)}`
  );
}

const fromEmpty = sanitizeOptionalExtras([], BATHROOM_SITE_NOTES);
assertExtras(fromEmpty, "sanitizeOptionalExtras empty AI");

const fromCombined = sanitizeOptionalExtras(
  aiProposalCombinedExtra.optionalExtras,
  BATHROOM_SITE_NOTES
);
assertExtras(fromCombined, "sanitizeOptionalExtras combined AI item");

const sanitized = sanitizeGeneratedProposal(
  aiProposalCombinedExtra,
  BATHROOM_SITE_NOTES,
  null,
  null
);
assertExtras(sanitized.optionalExtras, "full sanitize");
assert(
  !sanitized.scopeOfWork.some((item) => /replacement bathroom door/i.test(item)),
  "optional extra should not remain in scope"
);
assert(
  !sanitized.thingsToConfirm.some((item) => /optional extra/i.test(item)),
  "optional extra should not remain in thingsToConfirm"
);

if (failures.length > 0) {
  console.error("FAILED bathroom optional extras checks:");
  for (const failure of failures) {
    console.error(" -", failure);
  }
  process.exit(1);
}

console.log("PASSED bathroom optional extras checks");
console.log(sanitized.optionalExtras);
