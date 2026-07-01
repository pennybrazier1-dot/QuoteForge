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
};

export const GENERATED_PROPOSAL_JSON_SCHEMA = {
  type: "object",
  properties: {
    jobSummary: {
      type: "string",
      description:
        "A short paragraph summarising the main work from Site Notes.",
    },
    scopeOfWork: {
      type: "array",
      items: { type: "string" },
      description:
        "Bullet points of main quoted work extracted from Site Notes. Exclude optional extras.",
    },
    materials: {
      type: "array",
      items: { type: "string" },
      description:
        "Materials extracted from Site Notes, including clearly implied core materials. Do not invent specifications. Use 'Material — details to be confirmed' when unknown.",
    },
    labour: {
      type: "string",
      description:
        "Labour and work extracted from Site Notes. Mention price only if manual price provided or clearly stated in Site Notes. Do not invent prices.",
    },
    estimatedDuration: {
      type: "string",
      description:
        "Use manual Estimated Duration when provided. Otherwise use duration clearly stated in Site Notes. If not safe to estimate, use exactly: Estimated duration cannot yet be determined from the information provided.",
    },
    thingsToConfirm: {
      type: "array",
      items: { type: "string" },
      description:
        "Assumptions, missing details, and anything that must be confirmed before work begins. Include missing material specifications, quantities, and types here.",
    },
    optionalExtras: {
      type: "array",
      items: { type: "string" },
      description:
        "Optional work separate from the main quoted scope. Use optional extras notes when provided. Do not include in scopeOfWork, materials, labour, or main price. Empty array if none provided or mentioned.",
    },
    paymentTerms: {
      type: "string",
      description: "Payment terms for the proposal.",
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
  ],
  additionalProperties: false,
} as const;
