import type { TradeQuestion, TradeType } from "./types";

const baseQuestions: TradeQuestion[] = [
  {
    id: "urgency",
    label: "How soon would you like the work done?",
    type: "radio",
    options: [
      "As soon as possible",
      "Within the next few weeks",
      "I'm flexible on timing",
      "Just getting a quote for now",
    ],
  },
];

export const TRADE_QUESTION_TEMPLATES: Record<TradeType, TradeQuestion[]> = {
  electrical: [
    {
      id: "electrical_type",
      label: "What type of electrical work do you need?",
      type: "select",
      options: [
        "New sockets or switches",
        "Lighting installation",
        "Fuse board / consumer unit",
        "Full rewire",
        "Fault finding",
        "Other",
      ],
    },
    {
      id: "electrical_rooms",
      label: "Which rooms? (optional)",
      type: "textarea",
      placeholder: "e.g. Kitchen and living room",
      required: false,
      helperText: "Only if you know — skip if you're not sure.",
    },
    ...baseQuestions,
  ],
  plumbing: [
    {
      id: "plumbing_type",
      label: "What plumbing work do you need?",
      type: "select",
      options: [
        "Leak or repair",
        "New bathroom",
        "Boiler or heating",
        "Tap or toilet",
        "Pipework",
        "Other",
      ],
    },
    {
      id: "plumbing_access",
      label: "Is there easy access to the area?",
      type: "radio",
      options: ["Yes", "Limited access", "Not sure"],
    },
    ...baseQuestions,
  ],
  kitchen: [
    {
      id: "kitchen_scope",
      label: "What are you looking to do?",
      type: "select",
      options: [
        "Full kitchen replacement",
        "New worktops",
        "New appliances",
        "Plumbing for kitchen",
        "Other",
      ],
    },
    {
      id: "kitchen_units",
      label: "Do you already have units picked out?",
      type: "radio",
      options: ["Yes, I have a supplier", "I need help choosing", "Not yet"],
    },
    ...baseQuestions,
  ],
  bathroom: [
    {
      id: "bathroom_scope",
      label: "What bathroom work do you need?",
      type: "select",
      options: [
        "Full bathroom refit",
        "Shower installation",
        "Bath replacement",
        "Tiling only",
        "Other",
      ],
    },
    {
      id: "bathroom_suite",
      label: "Do you have a suite in mind?",
      type: "radio",
      options: ["Yes", "Need recommendations", "Not yet"],
    },
    ...baseQuestions,
  ],
  building: [
    {
      id: "building_type",
      label: "What building work is required?",
      type: "select",
      options: [
        "Extension",
        "Loft conversion",
        "Structural alterations",
        "New build element",
        "Other",
      ],
    },
  ],
  roofing: [
    {
      id: "roofing_issue",
      label: "What is the issue or requirement?",
      type: "select",
      options: [
        "Leak or repair",
        "Full re-roof",
        "Flat roof",
        "Guttering",
        "Other",
      ],
    },
  ],
  landscaping: [
    {
      id: "landscaping_scope",
      label: "What landscaping work do you need?",
      type: "select",
      options: [
        "Garden design",
        "Patio or decking",
        "Fencing",
        "Lawn or planting",
        "Other",
      ],
    },
  ],
  carpentry: [
    {
      id: "carpentry_type",
      label: "What carpentry work do you need?",
      type: "select",
      options: [
        "Doors or frames",
        "Flooring",
        "Built-in storage",
        "Staircase",
        "Other",
      ],
    },
  ],
  decorating: [
    {
      id: "decorating_scope",
      label: "What decorating work is needed?",
      type: "select",
      options: [
        "Full redecoration",
        "Single room",
        "Exterior painting",
        "Wallpapering",
        "Other",
      ],
    },
  ],
  heating: [
    {
      id: "heating_type",
      label: "What heating work do you need?",
      type: "select",
      options: [
        "New boiler",
        "Boiler service or repair",
        "Radiators",
        "Underfloor heating",
        "Other",
      ],
    },
  ],
  drainage: [
    {
      id: "drainage_issue",
      label: "What is the drainage issue?",
      type: "select",
      options: [
        "Blocked drain",
        "Slow drainage",
        "New drainage",
        "Septic tank",
        "Other",
      ],
    },
  ],
  something_else: [
    {
      id: "other_description",
      label: "Please describe the work you need",
      type: "textarea",
      placeholder: "Tell us as much as you can about your project",
    },
    ...baseQuestions,
  ],
};

export function getTradeQuestions(trade: TradeType | null): TradeQuestion[] {
  if (!trade) {
    return baseQuestions;
  }

  return TRADE_QUESTION_TEMPLATES[trade];
}

export function getRequiredTradeQuestions(trade: TradeType | null): TradeQuestion[] {
  return getTradeQuestions(trade).filter((question) => question.required !== false);
}
