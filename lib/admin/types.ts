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

export type BusinessStatus = "active" | "trial" | "suspended";
export type SubscriptionStatus = "active" | "trial" | "cancelled" | "past_due";

export type PlatformBusiness = {
  id: string;
  name: string;
  status: BusinessStatus;
  subscriptionStatus: SubscriptionStatus;
  tradeType: string;
  enquiryCount: number;
  jobCount: number;
  ownerEmail: string;
};

export type PlatformUserRole = "owner" | "member" | "platform_admin";
export type PlatformUserStatus = "active" | "invited" | "suspended";

export type PlatformUser = {
  id: string;
  name: string;
  email: string;
  role: PlatformUserRole;
  businessName: string;
  status: PlatformUserStatus;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  priceLabel: string;
  activeCount: number;
  trialCount: number;
  cancelledCount: number;
};

export type SubscriptionRecord = {
  id: string;
  businessName: string;
  planName: string;
  status: SubscriptionStatus;
  paymentStatus: "paid" | "pending" | "failed" | "n/a";
  renewsOn: string;
};

export type SupportIssuePriority = "low" | "medium" | "high";
export type SupportIssueStatus = "open" | "in_progress" | "resolved";

export type SupportIssue = {
  id: string;
  subject: string;
  reportedBy: string;
  businessName: string;
  status: SupportIssueStatus;
  priority: SupportIssuePriority;
  assignedTo: string;
};

export type CustomerJourneyPreview = {
  id: string;
  href: string;
  title: string;
  description: string;
  status: "live" | "preview" | "draft";
  notes: string;
};

export type PlatformOverviewStats = {
  activeBusinesses: number;
  newSignupsThisMonth: number;
  openIssues: number;
  monthlyRevenueLabel: string;
  systemHealthLabel: string;
  systemHealthDetail: string;
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  approved: "Approved",
  rejected: "Rejected",
};

export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = {
  active: "Active",
  trial: "Trial",
  suspended: "Suspended",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Active",
  trial: "Trial",
  cancelled: "Cancelled",
  past_due: "Past due",
};

export const USER_ROLE_LABELS: Record<PlatformUserRole, string> = {
  owner: "Owner",
  member: "Member",
  platform_admin: "Platform admin",
};

export const SUPPORT_STATUS_LABELS: Record<SupportIssueStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const SUPPORT_PRIORITY_LABELS: Record<SupportIssuePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
