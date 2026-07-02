export type GenerateProposalInput = {
  tradeType: string | null;
  businessName: string;
  customerName: string;
  siteNotes: string;
  optionalExtrasNotes: string | null;
  estimatedDuration: string | null;
  estimatedPrice: string | null;
  defaultPaymentTerms: string;
};

export type GeneratedProposal = {
  jobSummary: string;
  scopeOfWork: string[];
  materials: string[];
  labour: string;
  estimatedDuration: string;
  thingsToConfirm: string[];
  optionalExtras: string[];
  paymentTerms: string;
  /** Extracted from Site Notes when clearly stated — empty string if missing. */
  extractedCustomerName: string;
  extractedPropertyAddress: string;
  extractedPhoneNumber: string;
  extractedEmailAddress: string;
  /** Numeric price reference only (e.g. "850") — empty if not clearly stated. */
  extractedEstimatedPrice: string;
  /** Planned start wording from Site Notes — exact or vague. Empty if not mentioned. */
  plannedStartDate: string;
  /** ISO date (YYYY-MM-DD) only when an exact calendar date is clear. Empty if vague. */
  plannedStartDateExact: string;
};

export const GENERATED_PROPOSAL_JSON_SCHEMA = {
  type: "object",
  properties: {
    jobSummary: {
      type: "string",
      description:
        "A short paragraph summarising the main work from Site Notes. Preserve qualifying language from Site Notes.",
    },
    scopeOfWork: {
      type: "array",
      items: { type: "string" },
      description:
        "Bullet points of main quoted work extracted from Site Notes. Preserve qualifiers such as approximately, depending on, if suitable, and where possible. Exclude optional extras.",
    },
    materials: {
      type: "array",
      items: { type: "string" },
      description:
        "Materials extracted from Site Notes, including clearly implied core materials. Preserve qualifying language. Do not invent specifications. Use 'Material — details to be confirmed' when unknown.",
    },
    labour: {
      type: "string",
      description:
        "Labour and work extracted from Site Notes. Preserve qualified price wording such as around or approximately. Mention price only if manual price provided or clearly stated in Site Notes. Do not invent prices.",
    },
    estimatedDuration: {
      type: "string",
      description:
        "Use manual Estimated Duration when provided. Otherwise preserve the full qualified duration wording from Site Notes, including conditions such as depending on ground conditions. If not safe to estimate, use exactly: Estimated duration cannot yet be determined from the information provided.",
    },
    thingsToConfirm: {
      type: "array",
      items: { type: "string" },
      description:
        "Assumptions, missing details, and anything that must be confirmed before work begins. Include helpful confirmations for qualified conditions from Site Notes. Include missing material specifications, quantities, and types here.",
    },
    optionalExtras: {
      type: "array",
      items: { type: "string" },
      description:
        "Optional work separate from the main quoted scope. Extract from Site Notes when clearly marked as optional, extra, separate quote, or while-on-site add-on. Also use the separate Optional Extras field when provided. Do not include in scopeOfWork, materials, labour, or main price. Empty array if none.",
    },
    paymentTerms: {
      type: "string",
      description: "Payment terms for the proposal.",
    },
    extractedCustomerName: {
      type: "string",
      description:
        "Customer or client name from Site Notes only when clearly stated. Empty string if not stated. Do not invent.",
    },
    extractedPropertyAddress: {
      type: "string",
      description:
        "Property or job site address from Site Notes only when clearly stated. Empty string if not stated.",
    },
    extractedPhoneNumber: {
      type: "string",
      description:
        "Customer phone number from Site Notes only when clearly stated. Empty string if not stated.",
    },
    extractedEmailAddress: {
      type: "string",
      description:
        "Customer email from Site Notes only when clearly stated. Empty string if not stated.",
    },
    extractedEstimatedPrice: {
      type: "string",
      description:
        "Main quote price from Site Notes or manual context only when clearly stated (digits only, e.g. 850). Empty string if not stated. Do not invent.",
    },
    plannedStartDate: {
      type: "string",
      description:
        "When the customer wants work to start, as stated in Site Notes. Preserve flexible UK wording (e.g. 18th September, week commencing 18th September, middle of August, after the bank holiday, in October). Empty string if not mentioned. Do not invent.",
    },
    plannedStartDateExact: {
      type: "string",
      description:
        "ISO date YYYY-MM-DD only when a single exact calendar date is clearly stated (e.g. 18th September 2026). Empty string for vague ranges, months only, or week commencing without a single fixed day. Do not guess.",
    },
  },
  required: [
    "jobSummary",
    "scopeOfWork",
    "materials",
    "labour",
    "estimatedDuration",
    "thingsToConfirm",
    "optionalExtras",
    "paymentTerms",
    "extractedCustomerName",
    "extractedPropertyAddress",
    "extractedPhoneNumber",
    "extractedEmailAddress",
    "extractedEstimatedPrice",
    "plannedStartDate",
    "plannedStartDateExact",
  ],
  additionalProperties: false,
} as const;
