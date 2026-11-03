import type { VisitStatus, VisitType } from "@/lib/visits/types";
import {
  formatVisitAddress,
  formatVisitStatus,
  formatVisitType,
} from "@/lib/visits/types";
import { buildVisitSlotLabel } from "@/lib/visits/customer-confirmation/starts-at";

/** Customer-safe confirmation payload — never include notes, photos, or internal ids. */
export type PublicVisitConfirmationView = {
  token: string;
  businessName: string;
  visitDateTime: string;
  visitPurpose: string;
  address: string;
  status: VisitStatus;
  statusLabel: string;
  isCancelled: boolean;
  projectSummary: string | null;
};

export type PublicVisitConfirmationSource = {
  customer_access_token: string;
  visit_type: VisitType | string;
  visit_date: string;
  visit_time: string | null;
  slot_label: string | null;
  status: VisitStatus | string;
  enquiry_summary: string;
  address_line_1: string;
  address_line_2: string;
  town: string;
  county: string;
  postcode: string;
  business_name: string | null;
};

const PRIVATE_KEYS = [
  "id",
  "visit_id",
  "workspace_id",
  "customer_id",
  "enquiry_id",
  "linked_proposal_id",
  "source_site_visit_id",
  "notes",
  "contact_email",
  "contact_phone",
  "customer_name",
] as const;

export function assertPublicVisitViewHasNoPrivateFields(
  view: PublicVisitConfirmationView
): void {
  const keys = Object.keys(view);
  for (const forbidden of PRIVATE_KEYS) {
    if (keys.includes(forbidden)) {
      throw new Error(`Public visit view must not expose ${forbidden}`);
    }
  }
}

export function buildPublicVisitConfirmationView(
  source: PublicVisitConfirmationSource
): PublicVisitConfirmationView {
  const status = source.status as VisitStatus;
  const isCancelled = status === "cancelled" || status === "no_show";
  const summary = source.enquiry_summary.trim();
  const purpose = formatVisitType(source.visit_type);
  const visitDateTime =
    source.slot_label?.trim() ||
    buildVisitSlotLabel(source.visit_date, source.visit_time);

  const view: PublicVisitConfirmationView = {
    token: source.customer_access_token,
    businessName: source.business_name?.trim() || "Your tradesperson",
    visitDateTime,
    visitPurpose: purpose,
    address: formatVisitAddress(source),
    status,
    statusLabel: formatVisitStatus(status),
    isCancelled,
    projectSummary: summary || null,
  };

  assertPublicVisitViewHasNoPrivateFields(view);
  return view;
}
