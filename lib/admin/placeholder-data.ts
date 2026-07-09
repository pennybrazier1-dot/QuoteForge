import type {
  CustomerJourneyPreview,
  PlatformBusiness,
  PlatformOverviewStats,
  PlatformUser,
  SubscriptionPlan,
  SubscriptionRecord,
  SupportIssue,
  TradeServiceRequest,
} from "@/lib/admin/types";

export const PLACEHOLDER_OVERVIEW_STATS: PlatformOverviewStats = {
  activeBusinesses: 24,
  newSignupsThisMonth: 6,
  openIssues: 3,
  monthlyRevenueLabel: "£1,240",
  systemHealthLabel: "Healthy",
  systemHealthDetail: "All services operational. Placeholder monitoring.",
};

export const PLACEHOLDER_BUSINESSES: PlatformBusiness[] = [
  {
    id: "biz-1",
    name: "Smith Plumbing",
    status: "active",
    subscriptionStatus: "active",
    tradeType: "Plumber",
    enquiryCount: 18,
    jobCount: 11,
    ownerEmail: "john@smithplumbing.example",
  },
  {
    id: "biz-2",
    name: "Jones Electrical",
    status: "active",
    subscriptionStatus: "active",
    tradeType: "Electrician",
    enquiryCount: 9,
    jobCount: 6,
    ownerEmail: "sarah@joneselectrical.example",
  },
  {
    id: "biz-3",
    name: "Bright Decorators",
    status: "trial",
    subscriptionStatus: "trial",
    tradeType: "Painter and Decorator",
    enquiryCount: 4,
    jobCount: 1,
    ownerEmail: "mike@brightdecorators.example",
  },
  {
    id: "biz-4",
    name: "Green Gardens",
    status: "active",
    subscriptionStatus: "past_due",
    tradeType: "Landscaper",
    enquiryCount: 7,
    jobCount: 3,
    ownerEmail: "anna@greengardens.example",
  },
  {
    id: "biz-5",
    name: "Smith Home Services",
    status: "suspended",
    subscriptionStatus: "cancelled",
    tradeType: "General Handyman",
    enquiryCount: 12,
    jobCount: 8,
    ownerEmail: "alex@smithhomeservices.example",
  },
];

export const PLACEHOLDER_USERS: PlatformUser[] = [
  {
    id: "user-1",
    name: "John Smith",
    email: "john@smithplumbing.example",
    role: "owner",
    businessName: "Smith Plumbing",
    status: "active",
  },
  {
    id: "user-2",
    name: "Sarah Jones",
    email: "sarah@joneselectrical.example",
    role: "owner",
    businessName: "Jones Electrical",
    status: "active",
  },
  {
    id: "user-3",
    name: "Mike Bright",
    email: "mike@brightdecorators.example",
    role: "owner",
    businessName: "Bright Decorators",
    status: "active",
  },
  {
    id: "user-4",
    name: "Narel Admin",
    email: "narel@quoteforge.example",
    role: "platform_admin",
    businessName: "QuoteForge Platform",
    status: "active",
  },
  {
    id: "user-5",
    name: "Tom Helper",
    email: "tom@smithplumbing.example",
    role: "member",
    businessName: "Smith Plumbing",
    status: "invited",
  },
];

export const PLACEHOLDER_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "plan-starter",
    name: "Starter",
    priceLabel: "£29 / month",
    activeCount: 14,
    trialCount: 4,
    cancelledCount: 2,
  },
  {
    id: "plan-pro",
    name: "Pro",
    priceLabel: "£59 / month",
    activeCount: 8,
    trialCount: 2,
    cancelledCount: 1,
  },
];

export const PLACEHOLDER_SUBSCRIPTIONS: SubscriptionRecord[] = [
  {
    id: "sub-1",
    businessName: "Smith Plumbing",
    planName: "Pro",
    status: "active",
    paymentStatus: "paid",
    renewsOn: "2026-08-01",
  },
  {
    id: "sub-2",
    businessName: "Jones Electrical",
    planName: "Starter",
    status: "active",
    paymentStatus: "paid",
    renewsOn: "2026-07-28",
  },
  {
    id: "sub-3",
    businessName: "Bright Decorators",
    planName: "Starter",
    status: "trial",
    paymentStatus: "n/a",
    renewsOn: "2026-07-15",
  },
  {
    id: "sub-4",
    businessName: "Green Gardens",
    planName: "Pro",
    status: "past_due",
    paymentStatus: "failed",
    renewsOn: "2026-07-10",
  },
  {
    id: "sub-5",
    businessName: "Smith Home Services",
    planName: "Starter",
    status: "cancelled",
    paymentStatus: "n/a",
    renewsOn: "—",
  },
];

export const PLACEHOLDER_TRADE_SERVICE_REQUESTS: TradeServiceRequest[] = [
  {
    id: "req-1",
    requestedName: "Asbestos removal",
    description: "Licensed removal and disposal for garage roof sheets.",
    reason: "We get asked about this monthly on older properties.",
    requestedBy: "Smith Building Ltd",
    status: "new",
  },
  {
    id: "req-2",
    requestedName: "EV charger installation",
    description: "Home wallbox installs with consumer unit checks.",
    reason: "Growing demand from customers with new electric cars.",
    requestedBy: "Jones Electrical",
    status: "reviewing",
  },
  {
    id: "req-3",
    requestedName: "Scaffolding",
    description: "Temporary scaffolding for exterior painting jobs.",
    reason: "We subcontract today but would like a proper category.",
    requestedBy: "Bright Decorators",
    status: "approved",
  },
  {
    id: "req-4",
    requestedName: "Pest control",
    description: "Rodent and insect treatment for domestic properties.",
    reason: "Not a trade we plan to offer.",
    requestedBy: "Green Gardens",
    status: "rejected",
  },
];

export const PLACEHOLDER_CUSTOMER_JOURNEYS: CustomerJourneyPreview[] = [
  {
    id: "journey-default",
    href: "/request-quote",
    title: "Default enquiry",
    description: "Single-trade preview — Smith Plumbing.",
    status: "live",
    notes: "Welcome → details → property → project → photos → measurements → trade questions → review.",
  },
  {
    id: "journey-multi",
    href: "/request-quote/multi",
    title: "Multi-trade enquiry",
    description: "Service picker with multiple trades.",
    status: "preview",
    notes: "Includes work type step. Customers pick closest service and describe work later.",
  },
  {
    id: "journey-handyman",
    href: "/request-quote/handyman",
    title: "Handyman enquiry",
    description: "Custom handyman service list.",
    status: "preview",
    notes: "16 configurable services. Handyman labels map to question templates via keywords.",
  },
];

export const PLACEHOLDER_SUPPORT_ISSUES: SupportIssue[] = [
  {
    id: "issue-1",
    subject: "Customer cannot submit enquiry photos on iPhone",
    reportedBy: "Homeowner via Smith Plumbing",
    businessName: "Smith Plumbing",
    status: "open",
    priority: "high",
    assignedTo: "Unassigned",
  },
  {
    id: "issue-2",
    subject: "PDF proposal missing business logo",
    reportedBy: "Sarah Jones",
    businessName: "Jones Electrical",
    status: "in_progress",
    priority: "medium",
    assignedTo: "Narel",
  },
  {
    id: "issue-3",
    subject: "Trial user asking about subscription upgrade",
    reportedBy: "Mike Bright",
    businessName: "Bright Decorators",
    status: "open",
    priority: "low",
    assignedTo: "Support",
  },
];
