import {
  EMPTY_PAYMENT_SETTINGS,
  type WorkspacePaymentSettings,
} from "@/lib/payments/types";

const CARD_NUMBER_PATTERN = /\b(?:\d[ -]*?){13,19}\b/;
const CVV_KEYS = ["cvv", "cvc", "card_number", "pan", "cardnumber"];

export function emptyPaymentSettings(
  workspaceId: string
): WorkspacePaymentSettings {
  return { workspace_id: workspaceId, ...EMPTY_PAYMENT_SETTINGS };
}

export function normalizeSortCode(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  if (digits.length !== 6) {
    return value.trim();
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
}

export function normalizeAccountNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function looksLikeRawCardData(value: string): boolean {
  const lower = value.toLowerCase();
  if (CVV_KEYS.some((key) => lower.includes(key))) {
    return true;
  }
  const compact = value.replace(/\D/g, "");
  return compact.length >= 13 && CARD_NUMBER_PATTERN.test(value);
}

export function sanitizeExternalPaymentUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export type PaymentSettingsInput = {
  accept_bank_transfer?: boolean;
  accept_card_link?: boolean;
  accept_card_in_person?: boolean;
  accept_cash?: boolean;
  accept_other?: boolean;
  bank_account_name?: string | null;
  bank_sort_code?: string | null;
  bank_account_number?: string | null;
  bank_reference_instructions?: string | null;
  external_payment_url?: string | null;
  other_method_label?: string | null;
};

export function preparePaymentSettingsWrite(
  workspaceId: string,
  input: PaymentSettingsInput
):
  | { ok: true; row: WorkspacePaymentSettings }
  | { ok: false; error: string } {
  const bankName = input.bank_account_name?.trim() || null;
  const sortCode = input.bank_sort_code
    ? normalizeSortCode(input.bank_sort_code)
    : null;
  const accountNumber = input.bank_account_number
    ? normalizeAccountNumber(input.bank_account_number)
    : null;
  const reference = input.bank_reference_instructions?.trim() || null;
  const otherLabel = input.other_method_label?.trim() || null;
  const cardUrl = sanitizeExternalPaymentUrl(input.external_payment_url ?? "");

  const sensitive = [bankName, sortCode, accountNumber, reference, otherLabel]
    .filter(Boolean)
    .join(" ");
  if (looksLikeRawCardData(sensitive)) {
    return { ok: false, error: "Card numbers cannot be stored in Reanvil." };
  }

  if (input.accept_bank_transfer) {
    if (!bankName || !sortCode || !accountNumber) {
      return {
        ok: false,
        error: "Add account name, sort code and account number for bank transfer.",
      };
    }
    if (!/^\d{2}-\d{2}-\d{2}$/.test(sortCode)) {
      return { ok: false, error: "Enter a valid sort code." };
    }
    if (accountNumber.length < 6) {
      return { ok: false, error: "Enter a valid account number." };
    }
  }

  if (input.accept_card_link && !cardUrl) {
    return {
      ok: false,
      error: "Add a secure https payment link for card payments.",
    };
  }

  return {
    ok: true,
    row: {
      workspace_id: workspaceId,
      accept_bank_transfer: Boolean(input.accept_bank_transfer),
      accept_card_link: Boolean(input.accept_card_link),
      accept_card_in_person: Boolean(input.accept_card_in_person),
      accept_cash: Boolean(input.accept_cash),
      accept_other: Boolean(input.accept_other),
      bank_account_name: input.accept_bank_transfer ? bankName : null,
      bank_sort_code: input.accept_bank_transfer ? sortCode : null,
      bank_account_number: input.accept_bank_transfer ? accountNumber : null,
      bank_reference_instructions: input.accept_bank_transfer ? reference : null,
      external_payment_url: input.accept_card_link ? cardUrl : null,
      other_method_label: input.accept_other ? otherLabel : null,
    },
  };
}

export function publicSafePaymentSettings(
  settings: WorkspacePaymentSettings
): Pick<
  WorkspacePaymentSettings,
  | "workspace_id"
  | "accept_bank_transfer"
  | "accept_card_link"
  | "accept_card_in_person"
  | "accept_cash"
  | "accept_other"
> {
  return {
    workspace_id: settings.workspace_id,
    accept_bank_transfer: settings.accept_bank_transfer,
    accept_card_link: settings.accept_card_link,
    accept_card_in_person: settings.accept_card_in_person,
    accept_cash: settings.accept_cash,
    accept_other: settings.accept_other,
  };
}
