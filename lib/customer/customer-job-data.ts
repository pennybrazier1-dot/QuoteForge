import { PLACEHOLDER_TRADESPERSON } from "@/lib/customer-journey/constants";
import { formatEnquiryAddress } from "@/lib/enquiries/format";
import type { StoredEnquiry } from "@/lib/enquiries/types";

export type CustomerJobStatusStep = {
  id: string;
  label: string;
  state: "complete" | "current" | "upcoming";
};

export type CustomerJobViewModel = {
  enquiryId: string;
  businessName: string;
  visitDateTime: string;
  address: string;
  visitPurpose: string;
  projectDescription: string;
  preparationNote: string;
  tradespersonPhone: string;
  tradespersonEmail: string;
  statusSteps: CustomerJobStatusStep[];
};

export const CUSTOMER_JOB_PREPARATION_NOTE =
  "Please make sure the work area is accessible before we arrive.";

function formatVisitDateTime(enquiry: StoredEnquiry): string {
  if (enquiry.siteVisitStartsAt) {
    const date = new Date(enquiry.siteVisitStartsAt);

    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    }
  }

  if (enquiry.siteVisitSlot) {
    return enquiry.siteVisitSlot;
  }

  return "Date and time to be confirmed";
}

function resolveTradespersonPhone(enquiry: StoredEnquiry): string {
  return enquiry.tradespersonPhone.trim() || PLACEHOLDER_TRADESPERSON.phone;
}

function resolveTradespersonEmail(enquiry: StoredEnquiry): string {
  if (enquiry.tradespersonEmail.trim()) {
    return enquiry.tradespersonEmail.trim();
  }

  const businessSlug = enquiry.tradespersonBusiness
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 32);

  if (businessSlug) {
    return `hello@${businessSlug}.test`;
  }

  return "hello@quoteforge.test";
}

export function buildCustomerJobStatusSteps(
  status: StoredEnquiry["status"]
): CustomerJobStatusStep[] {
  const steps: CustomerJobStatusStep[] = [
    { id: "received", label: "Enquiry received", state: "complete" },
    { id: "site_visit", label: "Site visit booked", state: "upcoming" },
    { id: "quote", label: "Quote to follow", state: "upcoming" },
  ];

  if (status === "site_visit_booked") {
    steps[1] = { ...steps[1], state: "current" };
    return steps;
  }

  if (status === "declined") {
    return steps.map((step) => ({ ...step, state: "complete" as const }));
  }

  steps[0] = { ...steps[0], state: "current" };
  return steps;
}

export function buildCustomerJobViewModel(
  enquiry: StoredEnquiry
): CustomerJobViewModel {
  return {
    enquiryId: enquiry.id,
    businessName: enquiry.tradespersonBusiness.trim() || "Your tradesperson",
    visitDateTime: formatVisitDateTime(enquiry),
    address: formatEnquiryAddress(enquiry) || "Address to be confirmed",
    visitPurpose: enquiry.serviceRequested.trim() || "Site visit",
    projectDescription:
      enquiry.projectDescription.trim() || "No project details provided.",
    preparationNote: CUSTOMER_JOB_PREPARATION_NOTE,
    tradespersonPhone: resolveTradespersonPhone(enquiry),
    tradespersonEmail: resolveTradespersonEmail(enquiry),
    statusSteps: buildCustomerJobStatusSteps(enquiry.status),
  };
}

export function canRenderCustomerJobPage(enquiry: StoredEnquiry): boolean {
  return enquiry.status === "site_visit_booked";
}
