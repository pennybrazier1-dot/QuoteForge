export const CHANGE_REQUEST_LABELS = [
  "date",
  "scope",
  "materials",
  "price",
  "question",
] as const;

export type ChangeRequestLabel = (typeof CHANGE_REQUEST_LABELS)[number];

export type ChangeRequestSuggestedAction = {
  key: "check_calendar" | "review_proposal" | "review_pricing" | "reply";
  label: string;
  detail: string;
};

export type ChangeRequestAnalysis = {
  labels: ChangeRequestLabel[];
  summary: string;
  suggestedAction: ChangeRequestSuggestedAction;
};

const LABEL_PATTERNS: Record<ChangeRequestLabel, RegExp[]> = {
  date: [
    /\b(date|dates|schedule|scheduled|timing|start|begin|available|availability|postpone|bring forward|delay|sooner|later|tomorrow|weekend|weekday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|august|september|october|november|december|january|february|march|april|may|june|july)\b/i,
    /\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/,
    /\b(next week|this week|next month|asap)\b/i,
  ],
  scope: [
    /\b(scope|include|including|add|added|also need|remove|don't include|do not include|extra work|additional work|instead of|change the work|job description|plumbing|electrical|tiling)\b/i,
  ],
  materials: [
    /\b(material|materials|tile|tiles|colour|color|finish|brand|product|fixture|suite|spec|specification|upgrade|paint|wood|timber)\b/i,
  ],
  price: [
    /\b(price|pricing|cost|cheaper|expensive|budget|discount|quote|too much|reduce|deposit|payment|£|\bGBP\b|pounds?)\b/i,
  ],
  question: [
    /\?/,
    /\b(can you|could you|would you|how long|how much|what about|is it possible|please clarify|wondering|ask|asking)\b/i,
  ],
};

export function formatChangeRequestLabel(label: ChangeRequestLabel): string {
  switch (label) {
    case "date":
      return "Date";
    case "scope":
      return "Scope";
    case "materials":
      return "Materials";
    case "price":
      return "Price";
    case "question":
      return "Question";
  }
}

export function classifyChangeRequestLabels(message: string): ChangeRequestLabel[] {
  const text = message.trim();
  if (!text) {
    return ["question"];
  }

  const labels = CHANGE_REQUEST_LABELS.filter((label) =>
    LABEL_PATTERNS[label].some((pattern) => pattern.test(text))
  );

  return labels.length > 0 ? labels : ["question"];
}

function primarySuggestedAction(
  labels: ChangeRequestLabel[]
): ChangeRequestSuggestedAction {
  if (labels.includes("date")) {
    return {
      key: "check_calendar",
      label: "Check calendar",
      detail: "Review your availability, then agree a new start date with the customer.",
    };
  }
  if (labels.includes("price")) {
    return {
      key: "review_pricing",
      label: "Review pricing",
      detail: "Check whether the price still works before you reply or revise the quote.",
    };
  }
  if (labels.includes("scope") || labels.includes("materials")) {
    return {
      key: "review_proposal",
      label: "Review proposal",
      detail: "Check the scope and materials, then decide what can be updated.",
    };
  }
  return {
    key: "reply",
    label: "Reply",
    detail: "Answer the customer’s question before making any proposal changes.",
  };
}

function buildSummary(message: string, labels: ChangeRequestLabel[]): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
  const short =
    cleaned.length > 160 ? `${cleaned.slice(0, 157).trimEnd()}…` : cleaned;
  const labelText = labels.map(formatChangeRequestLabel).join(", ");

  if (labels.length === 1 && labels[0] === "question") {
    return `The customer is asking a question: “${short}”`;
  }

  if (labels.includes("date") && labels.length === 1) {
    return `The customer wants to change the timing: “${short}”`;
  }

  return `This looks like a ${labelText.toLowerCase()} request: “${short}”`;
}

/**
 * Local soft analysis for trader guidance only.
 * Never mutates proposal fields, price, or send status.
 */
export function analyzeChangeRequest(message: string): ChangeRequestAnalysis {
  const labels = classifyChangeRequestLabels(message);
  return {
    labels,
    summary: buildSummary(message, labels),
    suggestedAction: primarySuggestedAction(labels),
  };
}
