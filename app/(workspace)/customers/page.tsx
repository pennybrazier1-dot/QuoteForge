import type { Metadata } from "next";
import { CustomerList } from "@/components/customers/customer-list";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Customers — QuoteForge",
  description: "View your QuoteForge customers.",
};

export default async function CustomersPage() {
  const supabase = await createClient();

  const { data: customersData } = await supabase
    .from("customers")
    .select(
      "id, name, email, phone, address_line_1, address_line_2, town, county, postcode, created_at"
    )
    .order("created_at", { ascending: false });

  const customers = customersData ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Customers
      </h1>
      <p className="mt-2 text-sm text-muted">
        People you have quoted for. Customers are added when you save a
        proposal.
      </p>

      <div className="mt-8">
        <CustomerList customers={customers} />
      </div>
    </main>
  );
}
