import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateVisitForm } from "@/components/visits/create-visit-form";
import { requireWorkspaceContext } from "@/lib/enquiries/server/workspace-context";

export const metadata: Metadata = {
  title: "Book visit",
  description: "Schedule a site assessment visit.",
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

  const { data: customersData } = await context.supabase
    .from("customers")
    .select(
      "id, name, email, phone, address_line_1, address_line_2, town, county, postcode"
    )
    .eq("workspace_id", context.workspaceId)
    .order("name", { ascending: true });

  const customers = customersData ?? [];

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

  if (enquiryId) {
    const { data: enquiry } = await context.supabase
      .from("enquiries")
      .select(
        "id, customer_name, customer_mobile, customer_email, address_line_1, address_line_2, town, county, postcode, project_description, service_requested"
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
    }
  }

  return (
    <main className="qf-visit-page">
      <header className="qf-visit-page-header">
        <div>
          <Link href="/visits" className="qf-visit-back">
            ← Back to visits
          </Link>
          <h1 className="qf-visit-page-title">Book visit</h1>
          <p className="qf-visit-page-subtitle">
            Choose a customer, add the reason, and pick a date and time.
          </p>
        </div>
      </header>

      <CreateVisitForm
        customers={customers}
        preselectedCustomerId={customerId ?? null}
        enquiryPrefill={enquiryPrefill}
      />
    </main>
  );
}
