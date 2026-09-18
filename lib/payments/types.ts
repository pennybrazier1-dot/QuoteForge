export const PAYMENT_STATUSES = [
  "not_requested",
  "requested",
  "paid",
  "waived",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = [
  "bank_transfer",
  "card_link",
  "card_in_person",
  "cash",
  "other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type WorkspacePaymentSettings = {
  workspace_id: string;
  accept_bank_transfer: boolean;
  accept_card_link: boolean;
  accept_card_in_person: boolean;
  accept_cash: boolean;
  accept_other: boolean;
  bank_account_name: string | null;
  bank_sort_code: string | null;
  bank_account_number: string | null;
  bank_reference_instructions: string | null;
  external_payment_url: string | null;
  other_method_label: string | null;
};

export type JobPaymentState = {
  payment_status: PaymentStatus;
  payment_requested_at: string | null;
  payment_due_amount: number | null;
  payment_methods_issued: PaymentMethod[];
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  payment_provider: string | null;
  payment_provider_reference: string | null;
  closed_at: string | null;
};

export type IssuedBankDetails = {
  accountName: string;
  sortCode: string;
  accountNumber: string;
  reference: string | null;
};

export type CustomerPortalPaymentView = {
  status: PaymentStatus;
  amountLabel: string | null;
  jobTitle: string;
  methodLabels: string[];
  bank: IssuedBankDetails | null;
  cardUrl: string | null;
  cardInPerson: boolean;
  cash: boolean;
  otherLabel: string | null;
  closed: boolean;
};

export const EMPTY_PAYMENT_SETTINGS: Omit<WorkspacePaymentSettings, "workspace_id"> =
  {
    accept_bank_transfer: false,
    accept_card_link: false,
    accept_card_in_person: false,
    accept_cash: false,
    accept_other: false,
    bank_account_name: null,
    bank_sort_code: null,
    bank_account_number: null,
    bank_reference_instructions: null,
    external_payment_url: null,
    other_method_label: null,
  };

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export function parsePaymentMethods(value: unknown): PaymentMethod[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is PaymentMethod =>
    typeof item === "string" && isPaymentMethod(item)
  );
}
