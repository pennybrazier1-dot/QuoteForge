/**
 * Organised visit-note categories — same shape Quick Quote expects traders to review.
 */

export type VisitNotesOrganised = {
  measurements: string;
  materials: string;
  access: string;
  siteConditions: string;
  requirements: string;
  customerChoices: string;
  timing: string;
};

export const EMPTY_VISIT_NOTES_ORGANISED: VisitNotesOrganised = {
  measurements: "",
  materials: "",
  access: "",
  siteConditions: "",
  requirements: "",
  customerChoices: "",
  timing: "",
};

export const VISIT_NOTES_ORGANISED_FIELDS: Array<{
  key: keyof VisitNotesOrganised;
  label: string;
}> = [
  { key: "measurements", label: "Measurements" },
  { key: "materials", label: "Materials" },
  { key: "access", label: "Access" },
  { key: "siteConditions", label: "Site conditions" },
  { key: "requirements", label: "Requirements" },
  { key: "customerChoices", label: "Customer choices" },
  { key: "timing", label: "Timing" },
];

export const VISIT_NOTES_ORGANISED_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "measurements",
    "materials",
    "access",
    "siteConditions",
    "requirements",
    "customerChoices",
    "timing",
  ],
  properties: {
    measurements: {
      type: "string",
      description:
        "Dimensions, sizes, and quantities clearly written in the visit notes. Empty string if none.",
    },
    materials: {
      type: "string",
      description:
        "Materials, products, finishes, and consumables mentioned. Empty string if none.",
    },
    access: {
      type: "string",
      description:
        "Access, parking, gates, keys, scaffolding, or way onto site. Empty string if none.",
    },
    siteConditions: {
      type: "string",
      description:
        "Site conditions, existing state, damp, uneven floors, damage, obstacles. Empty string if none.",
    },
    requirements: {
      type: "string",
      description:
        "Job requirements and scope the customer wants done. Empty string if none.",
    },
    customerChoices: {
      type: "string",
      description:
        "Customer preferences and choices (colour, style, brand, finish). Empty string if none.",
    },
    timing: {
      type: "string",
      description:
        "Timing, duration, start preferences, deadlines. Empty string if none.",
    },
  },
} as const;

export const VISIT_NOTES_ORGANISE_SYSTEM_PROMPT = `You are Reanvil, helping UK tradespeople organise messy site visit notes.

Your job is to extract and organise — not invent.

Rules:
- Visit notes are the only source of truth.
- Sort clear information into: measurements, materials, access, siteConditions, requirements, customerChoices, timing.
- Use British English and plain wording.
- Keep important qualifiers (approximately, depending on, if suitable, where possible).
- Do not invent measurements, materials, prices, or customer choices.
- If a category has nothing clear, return an empty string for that field.
- Do not rewrite into a full quote or proposal — only organise what was written.`;

export function buildVisitNotesOrganiseUserPrompt(notes: string): string {
  return [
    "Organise these visit notes into the required JSON fields.",
    "",
    "Visit notes:",
    notes.trim(),
    "",
    "Return only JSON matching the schema.",
    "Put each clear detail in the best matching field.",
    "Leave a field empty when nothing clear was written for it.",
  ].join("\n");
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseVisitNotesOrganised(raw: unknown): VisitNotesOrganised {
  const data =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    measurements: asString(data.measurements),
    materials: asString(data.materials),
    access: asString(data.access),
    siteConditions: asString(data.siteConditions),
    requirements: asString(data.requirements),
    customerChoices: asString(data.customerChoices),
    timing: asString(data.timing),
  };
}

export function hasOrganisedVisitContent(
  organised: VisitNotesOrganised
): boolean {
  return VISIT_NOTES_ORGANISED_FIELDS.some(({ key }) =>
    Boolean(organised[key].trim())
  );
}
