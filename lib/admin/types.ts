import type { TradeType } from "@/lib/customer-journey/types";

export type RequestStatus = "new" | "reviewing" | "approved" | "rejected";

export type TradeServiceRequest = {
  id: string;
  requestedName: string;
  description: string;
  reason: string;
  requestedBy: string;
  status: RequestStatus;
};

export type SupportedPlatformTrade = {
  id: string;
  label: string;
  templateTradeType: TradeType;
  hasQuestionTemplate: boolean;
  questionCount: number;
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  approved: "Approved",
  rejected: "Rejected",
};
