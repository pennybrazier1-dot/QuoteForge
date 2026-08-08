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
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <header className="qf-proposal-header">
        <Link
          href={enquiryId ? `/enquiries/${enquiryId}` : "/visits"}
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          {enquiryId ? "← Back to enquiry" : "← Back to visits"}
        </Link>
        <h1 className="qf-proposal-title">Book visit</h1>
        <p className="qf-proposal-subtitle">
          {enquiryId
            ? "Customer details and enquiry summary are ready — pick a date and time."
            : "Choose a customer, add the reason, and pick a date and time."}
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
