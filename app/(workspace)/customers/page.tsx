import type { Metadata } from "next";
import Link from "next/link";
import { CustomerList } from "@/components/customers/customer-list";
import {
  filterCustomersByView,
  parseCustomerListView,
  type CustomerListView,
} from "@/lib/customers/lifecycle";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Customers",
  description: "View your Reanvil customers.",
};

type PageProps = {
  searchParams: Promise<{ view?: string }>;
};

const VIEWS: Array<{ id: CustomerListView; label: string }> = [
  { id: "active", label: "Active" },
  { id: "archived", label: "Archived" },
  { id: "scheduled", label: "Scheduled for deletion" },
];

export default async function CustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = parseCustomerListView(params.view);
  const supabase = await createClient();

  const { data: customersData } = await supabase
    .from("customers")
    .select(
      "id, name, email, phone, address_line_1, address_line_2, town, county, postcode, created_at, activated_at, archived_at, deletion_requested_at, deletion_scheduled_for, anonymised_at"
    )
    .order("created_at", { ascending: false });

  const customers = filterCustomersByView(customersData ?? [], view);

  return (
    <main className="qf-customer-page mx-auto w-full max-w-6xl flex-1 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Customers
          </h1>
          <p className="mt-2 text-sm text-muted">
            People whose work became real, plus anyone you add yourself. An
            enquiry or quote on its own does not create an active customer.
          </p>
        </div>
        {view === "active" ? (
          <Link href="/customers/new" className="qf-btn-primary">
            Add customer
          </Link>
        ) : null}
      </div>

      <nav className="qf-customer-view-tabs" aria-label="Customer lists">
        {VIEWS.map((item) => (
          <Link
            key={item.id}
            href={item.id === "active" ? "/customers" : `/customers?view=${item.id}`}
            className={
              item.id === view
                ? "qf-customer-view-tab is-active"
                : "qf-customer-view-tab"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">
        <CustomerList customers={customers} view={view} />
      </div>
    </main>
  );
}
