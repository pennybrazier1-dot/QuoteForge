import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerDetailView } from "@/components/customers/customer-detail-view";
import { CustomerProposals } from "@/components/customers/customer-proposals";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Customer — QuoteForge",
  description: "View a QuoteForge customer and their proposals.",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select(
      "id, name, email, phone, address_line_1, address_line_2, town, county, postcode, notes, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (customerError || !customer) {
    notFound();
  }

  const { data: proposalsData } = await supabase
    .from("proposals")
    .select("id, proposal_number, title, status, total_amount, created_at")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const proposals = proposalsData ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link
        href="/customers"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to Customers
      </Link>

      <div className="mt-6 qf-stack">
        <CustomerDetailView customer={customer} />
        <CustomerProposals proposals={proposals} />
      </div>
    </main>
  );
}
