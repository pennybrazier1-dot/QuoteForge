export const JOB_PREP_ITEM_KEYS = [
  "customer_details",
  "measurements",
  "site_visit",
  "materials",
  "access_requirements",
  "start_date",
] as const;

export type JobPrepItemKey = (typeof JOB_PREP_ITEM_KEYS)[number];

export const JOB_PREP_ITEM_STATUSES = [
  "open",
  "confirmed",
  "not_needed",
] as const;

export type JobPrepItemStatus = (typeof JOB_PREP_ITEM_STATUSES)[number];

export type JobPrepItemDefinition = {
  key: JobPrepItemKey;
  label: string;
  actionLabel: string;
  sortOrder: number;
};

export const JOB_PREP_ITEM_DEFINITIONS: readonly JobPrepItemDefinition[] = [
  {
    key: "customer_details",
    label: "Customer details",
    actionLabel: "Review details",
    sortOrder: 10,
  },
  {
    key: "measurements",
    label: "Measurements",
    actionLabel: "Schedule site visit",
    sortOrder: 20,
  },
  {
    key: "site_visit",
    label: "Site visit",
    actionLabel: "Schedule site visit",
    sortOrder: 30,
  },
  {
    key: "materials",
    label: "Materials / specification",
    actionLabel: "Confirm materials",
    sortOrder: 40,
  },
  {
    key: "access_requirements",
    label: "Access requirements",
    actionLabel: "Confirm access",
    sortOrder: 50,
  },
  {
    key: "start_date",
    label: "Start date",
    actionLabel: "Schedule job",
    sortOrder: 60,
  },
] as const;

export function isJobPrepItemKey(value: string): value is JobPrepItemKey {
  return (JOB_PREP_ITEM_KEYS as readonly string[]).includes(value);
}

export function isJobPrepItemStatus(
  value: string
): value is JobPrepItemStatus {
  return (JOB_PREP_ITEM_STATUSES as readonly string[]).includes(value);
}

export function formatJobPrepItemStatus(status: string): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "not_needed":
      return "Not needed";
    case "open":
    default:
      return "Open";
  }
}

export function isPrepItemResolved(status: string): boolean {
  return status === "confirmed" || status === "not_needed";
}

export type JobPrepActionContext = {
  proposalId: string;
  customerId: string | null;
  enquiryId: string | null;
};

/** Primary action href — reuses existing enquiries/site-visit/calendar routes. */
export function buildJobPrepActionHref(
  key: JobPrepItemKey,
  context: JobPrepActionContext
): string {
  switch (key) {
    case "customer_details":
      return context.customerId
        ? `/customers/${context.customerId}`
        : `/proposals/${context.proposalId}/edit`;
    case "measurements":
    case "site_visit":
      return context.enquiryId
        ? `/enquiries/${context.enquiryId}`
        : "/enquiries";
    case "materials":
    case "access_requirements":
      return `/proposals/${context.proposalId}/edit`;
    case "start_date":
      return `/proposals/${context.proposalId}?confirmBooking=1`;
  }
}
