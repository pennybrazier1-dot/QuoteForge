import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateVisitForm } from "@/components/visits/create-visit-form";
import { loadCustomersForNameMatch } from "@/lib/customers/load-name-match";
import { requireWorkspaceContext } from "@/lib/enquiries/server/workspace-context";
import {
  NEW_VISIT_PAGE_SUBTITLE,
  NEW_VISIT_PAGE_TITLE,
} from "@/lib/visits/new-visit";

export const metadata: Metadata = {
  title: NEW_VISIT_PAGE_TITLE,
  description: "Arrange a visit to inspect, discuss or check work.",
};

type PageProps = {
  searchParams: Promise<{
    customerId?: string;
    enquiryId?: string;
  }>;
};

export default async function NewVisitPage({ searchParams }: PageProps) {
  const context = await requireWorkspaceContext();
  if (!context.ok) {
    redirect("/login");
  }

  const { customerId, enquiryId } = await searchParams;

  const customers = await loadCustomersForNameMatch(
    context.supabase,
    context.workspaceId
  );

  let enquiryPrefill: {
    enquiryId: string;
    customerName: string;
    contactPhone: string;
    contactEmail: string;
    addressLine1: string;
    addressLine2: string;
    town: string;
    county: string;
    postcode: string;
    enquirySummary: string;
  } | null = null;
  let linkedCustomerId: string | null = customerId ?? null;

  if (enquiryId) {
    const { data: enquiry } = await context.supabase
      .from("enquiries")
      .select(
        "id, customer_id, customer_name, customer_mobile, customer_email, address_line_1, address_line_2, town, county, postcode, project_description, service_requested"
      )
      .eq("id", enquiryId)
      .eq("workspace_id", context.workspaceId)
      .maybeSingle();

    if (enquiry) {
      enquiryPrefill = {
        enquiryId: enquiry.id,
        customerName: enquiry.customer_name ?? "",
        contactPhone: enquiry.customer_mobile ?? "",
        contactEmail: enquiry.customer_email ?? "",
        addressLine1: enquiry.address_line_1 ?? "",
        addressLine2: enquiry.address_line_2 ?? "",
        town: enquiry.town ?? "",
        county: enquiry.county ?? "",
        postcode: enquiry.postcode ?? "",
        enquirySummary: [
          enquiry.service_requested,
          enquiry.project_description,
        ]
          .filter(Boolean)
          .join("\n\n"),
      };

      if (!linkedCustomerId && enquiry.customer_id) {
        linkedCustomerId = enquiry.customer_id;
      }
    }
  }

  return (
    <main className="qf-mobile-form-page mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <header className="qf-proposal-header">
        <Link
          href={enquiryId ? `/enquiries/${enquiryId}` : "/visits"}
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          {enquiryId ? "← Back to enquiry" : "← Back to visits"}
        </Link>
        <h1 className="qf-proposal-title">{NEW_VISIT_PAGE_TITLE}</h1>
        <p className="qf-proposal-subtitle">
          {enquiryId
            ? "Customer details and enquiry summary are ready — pick a date and time."
            : NEW_VISIT_PAGE_SUBTITLE}
        </p>
      </header>

      <CreateVisitForm
        customers={customers}
        preselectedCustomerId={linkedCustomerId}
        enquiryPrefill={enquiryPrefill}
      />
    </main>
  );
}
