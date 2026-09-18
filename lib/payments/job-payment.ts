import { formatPenceAsGbp } from "@/lib/proposals/money";
import { isCompletedJobStatus, normalizeProposalStatus } from "@/lib/proposals/status";
import {
  isPaymentMethod,
  isPaymentStatus,
  parsePaymentMethods,
  type CustomerPortalPaymentView,
  type IssuedBankDetails,
  type JobPaymentState,
  type PaymentMethod,
  type PaymentStatus,
  type WorkspacePaymentSettings,
} from "@/lib/payments/types";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  not_requested: "Not requested",
  requested: "Awaiting payment",
  paid: "Paid",
  waived: "No payment required",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  card_link: "Card payment link",
  card_in_person: "Card in person",
  cash: "Cash",
  other: "Other agreed method",
};

export const CLOSE_JOB_BLOCKED_COPY =
  "This job cannot be closed until payment is received or marked as not required.";

export function readPaymentStatus(value: string | null | undefined): PaymentStatus {
  return value && isPaymentStatus(value) ? value : "not_requested";
}

export function formatPaymentStatus(value: string | null | undefined): string {
  return PAYMENT_STATUS_LABELS[readPaymentStatus(value)];
}

export function formatPaymentMethod(value: string | null | undefined): string {
  return value && isPaymentMethod(value)
    ? PAYMENT_METHOD_LABELS[value]
    : "Payment";
}

export function defaultPaymentDueAmount(
  proposalTotalPence: number | null | undefined
): number {
  return Math.max(0, proposalTotalPence ?? 0);
}

export function enabledPaymentMethods(
  settings: Pick<
    WorkspacePaymentSettings,
    | "accept_bank_transfer"
    | "accept_card_link"
    | "accept_card_in_person"
    | "accept_cash"
    | "accept_other"
  >
): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (settings.accept_bank_transfer) methods.push("bank_transfer");
  if (settings.accept_card_link) methods.push("card_link");
  if (settings.accept_card_in_person) methods.push("card_in_person");
  if (settings.accept_cash) methods.push("cash");
  if (settings.accept_other) methods.push("other");
  return methods;
}

export function canRequestPayment(input: {
  jobStatus: string;
  paymentStatus?: string | null;
  closedAt?: string | null;
}): boolean {
  return (
    isCompletedJobStatus(input.jobStatus) &&
    !input.closedAt &&
    readPaymentStatus(input.paymentStatus) === "not_requested"
  );
}

export function canMarkPaymentPaid(input: {
  jobStatus: string;
  paymentStatus?: string | null;
  closedAt?: string | null;
}): boolean {
  return (
    isCompletedJobStatus(input.jobStatus) &&
    !input.closedAt &&
    readPaymentStatus(input.paymentStatus) === "requested"
  );
}

export function canWaivePayment(input: {
  jobStatus: string;
  paymentStatus?: string | null;
  closedAt?: string | null;
}): boolean {
  const payment = readPaymentStatus(input.paymentStatus);
  return (
    isCompletedJobStatus(input.jobStatus) &&
    !input.closedAt &&
    (payment === "not_requested" || payment === "requested")
  );
}

export function isPaymentResolved(paymentStatus?: string | null): boolean {
  const payment = readPaymentStatus(paymentStatus);
  return payment === "paid" || payment === "waived";
}

export function canCloseJob(input: {
  jobStatus: string;
  paymentStatus?: string | null;
  closedAt?: string | null;
}): boolean {
  return (
    isCompletedJobStatus(input.jobStatus) &&
    !input.closedAt &&
    isPaymentResolved(input.paymentStatus)
  );
}

export function completedJobIsAutomaticallyClosed(): boolean {
  return false;
}

export function buildIssuedBankSnapshot(
  settings: WorkspacePaymentSettings,
  methods: PaymentMethod[]
): IssuedBankDetails | null {
  if (!methods.includes("bank_transfer")) {
    return null;
  }
  const accountName = settings.bank_account_name?.trim() ?? "";
  const sortCode = settings.bank_sort_code?.trim() ?? "";
  const accountNumber = settings.bank_account_number?.trim() ?? "";
  if (!accountName || !sortCode || !accountNumber) {
    return null;
  }
  return {
    accountName,
    sortCode,
    accountNumber,
    reference: settings.bank_reference_instructions?.trim() || null,
  };
}

export function buildIssuedPaymentUrl(
  settings: WorkspacePaymentSettings,
  methods: PaymentMethod[]
): string | null {
  if (!methods.includes("card_link")) {
    return null;
  }
  const url = settings.external_payment_url?.trim() ?? "";
  if (!/^https:\/\//i.test(url)) {
    return null;
  }
  return url;
}

export function paymentRequestTimelineNote(methods: PaymentMethod[]): string {
  const labels = methods.map((method) => PAYMENT_METHOD_LABELS[method]);
  return labels.length
    ? `Payment requested (${labels.join(", ")})`
    : "Payment requested";
}

export function paidTimelineNote(): string {
  return "Payment marked paid";
}

export function closedTimelineNote(): string {
  return "Job closed";
}

export function timelineContainsSensitiveBankDetails(note: string): boolean {
  return /\b\d{2}-?\d{2}-?\d{2}\b/.test(note) || /\b\d{6,8}\b/.test(note);
}

export function buildCustomerPortalPaymentView(input: {
  jobTitle: string;
  jobStatus: string;
  payment: JobPaymentState;
  bank: IssuedBankDetails | null;
  cardUrl: string | null;
  otherLabel?: string | null;
}): CustomerPortalPaymentView {
  const closed =
    normalizeProposalStatus(input.jobStatus) === "closed" ||
    Boolean(input.payment.closed_at);
  const requestedOrPaid =
    input.payment.payment_status === "requested" ||
    input.payment.payment_status === "paid" ||
    input.payment.payment_status === "waived";
  const methods = input.payment.payment_methods_issued;
  const showBank =
    input.payment.payment_status === "requested" &&
    methods.includes("bank_transfer") &&
    Boolean(input.bank);
  return {
    status: input.payment.payment_status,
    amountLabel:
      requestedOrPaid && input.payment.payment_due_amount != null
        ? formatPenceAsGbp(input.payment.payment_due_amount)
        : null,
    jobTitle: input.jobTitle,
    methodLabels: methods.map((method) => PAYMENT_METHOD_LABELS[method]),
    bank: showBank ? input.bank : null,
    cardUrl:
      input.payment.payment_status === "requested" &&
      methods.includes("card_link")
        ? input.cardUrl
        : null,
    cardInPerson:
      input.payment.payment_status === "requested" &&
      methods.includes("card_in_person"),
    cash:
      input.payment.payment_status === "requested" && methods.includes("cash"),
    otherLabel:
      input.payment.payment_status === "requested" && methods.includes("other")
        ? input.otherLabel?.trim() || PAYMENT_METHOD_LABELS.other
        : null,
    closed,
  };
}

export function readJobPaymentState(row: {
  payment_status?: string | null;
  payment_requested_at?: string | null;
  payment_due_amount?: number | null;
  payment_methods_issued?: unknown;
  paid_at?: string | null;
  payment_method?: string | null;
  payment_provider?: string | null;
  payment_provider_reference?: string | null;
  closed_at?: string | null;
}): JobPaymentState {
  return {
    payment_status: readPaymentStatus(row.payment_status),
    payment_requested_at: row.payment_requested_at ?? null,
    payment_due_amount: row.payment_due_amount ?? null,
    payment_methods_issued: parsePaymentMethods(row.payment_methods_issued),
    paid_at: row.paid_at ?? null,
    payment_method:
      row.payment_method && isPaymentMethod(row.payment_method)
        ? row.payment_method
        : null,
    payment_provider: row.payment_provider ?? null,
    payment_provider_reference: row.payment_provider_reference ?? null,
    closed_at: row.closed_at ?? null,
  };
}
