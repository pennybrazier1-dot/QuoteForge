import type { CustomerNameMatchOption } from "@/lib/customers/name-match";

export const NEW_VISIT_PAGE_TITLE = "New Visit";
export const NEW_VISIT_PAGE_SUBTITLE =
  "Choose the type of visit, then add who it is for and when you are going.";
export const VISIT_NAME_PLACEHOLDER = "Start typing a name...";
export const VISIT_FORM_SHOWS_SAVED_CUSTOMERS_SELECTOR = false;
export const DEFAULT_NEW_VISIT_TYPE = "initial_assessment" as const;

export const NEW_VISIT_TYPES = [
  "initial_assessment",
  "follow_up",
  "final_inspection",
] as const;

export type NewVisitType = (typeof NEW_VISIT_TYPES)[number];

export const NEW_VISIT_TYPE_OPTIONS: Array<{
  id: NewVisitType;
  label: string;
  helper: string;
  reasonPlaceholder: string;
}> = [
  {
    id: "initial_assessment",
    label: "Initial Visit",
    helper:
      "Inspect the work, take measurements and gather what you need to quote.",
    reasonPlaceholder:
      "Scope out the work, measurements needed, materials to check, access, customer requirements or anything else to inspect.",
  },
  {
    id: "follow_up",
    label: "Follow-Up Visit",
    helper:
      "Return to check something, gather more information or discuss changes.",
    reasonPlaceholder:
      "What do you need to go back and check, discuss or measure?",
  },
  {
    id: "final_inspection",
    label: "Final Inspection",
    helper:
      "Check completed work, finish quality and anything still outstanding.",
    reasonPlaceholder: "What needs checking before the work is signed off?",
  },
];

export function isNewVisitType(value: string): value is NewVisitType {
  return (NEW_VISIT_TYPES as readonly string[]).includes(value);
}

export function getNewVisitTypeOption(id: NewVisitType) {
  const option = NEW_VISIT_TYPE_OPTIONS.find((item) => item.id === id);
  if (!option) {
    throw new Error(`Unknown new visit type: ${id}`);
  }
  return option;
}

export function visitReasonPlaceholder(type: string): string {
  const option = NEW_VISIT_TYPE_OPTIONS.find((item) => item.id === type);
  return (
    option?.reasonPlaceholder ??
    getNewVisitTypeOption(DEFAULT_NEW_VISIT_TYPE).reasonPlaceholder
  );
}

export function applyVisitCustomerSuggestion(
  customer: CustomerNameMatchOption
) {
  return {
    customerId: customer.id,
    customerName: customer.name,
    contactPhone: customer.phone ?? "",
    contactEmail: customer.email ?? "",
    addressLine1: customer.address_line_1 ?? "",
    addressLine2: customer.address_line_2 ?? "",
    town: customer.town ?? "",
    county: customer.county ?? "",
    postcode: customer.postcode ?? "",
  };
}

export function planVisitSaveCustomerLink(input: {
  selectedCustomerId?: string | null;
}): {
  customerId: string | null;
  shouldCreateCustomer: boolean;
  shouldActivateCustomer: boolean;
  matchByName: boolean;
} {
  return {
    customerId: input.selectedCustomerId?.trim() || null,
    shouldCreateCustomer: false,
    shouldActivateCustomer: false,
    matchByName: false,
  };
}

export function visitCreateSideEffects() {
  return {
    createsVisit: true,
    createsQuote: false,
    createsProposal: false,
    createsJob: false,
    createsInvoice: false,
    createsActiveCustomer: false,
    appearsOnVisitsList: true,
    appearsOnCalendarAsVisit: true,
    calendarKind: "site_visit" as const,
    homepageBuckets: ["today_visit", "upcoming_visit"] as const,
  };
}
