export const ATTENTION_REASONS = [
  "customer_question",
  "customer_requested_changes",
  "customer_requested_date_change",
] as const;

export type AttentionReason = (typeof ATTENTION_REASONS)[number];

export function isAttentionReason(value: string): value is AttentionReason {
  return (ATTENTION_REASONS as readonly string[]).includes(value);
}

export function formatAttentionReason(reason: string | null | undefined): string {
  switch (reason) {
    case "customer_question":
      return "Customer asked a question";
    case "customer_requested_changes":
      return "Customer requested changes";
    case "customer_requested_date_change":
      return "Customer requested a date change";
    default:
      return "Needs your response";
  }
}
