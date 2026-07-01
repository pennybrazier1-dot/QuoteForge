import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CustomerEditForm } from "@/components/customers/customer-edit-form";
import { DashboardTopBar } from "@/components/dashboard/top-bar";
import { customerToFormValues } from "@/lib/customers/form-values";
import { userHasProfile } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit Customer — QuoteForge",
  description: "Update customer details in QuoteForge.",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await userHasProfile(user.id))) {
    redirect("/onboarding");
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .select(
      "id, name, email, phone, address_line_1, address_line_2, town, county, postcode, notes"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !customer) {
    notFound();
  }

  const initialValues = customerToFormValues(customer);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <DashboardTopBar email={user.email} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link
          href={`/customers/${id}`}
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
          Back to Customer
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
          Edit Customer
        </h1>
        <p className="mt-2 text-sm text-muted">
          Update this customer&apos;s contact details or notes. Changes are saved
          when you tap Save Customer.
        </p>

        <div className="mt-8">
          <CustomerEditForm customerId={id} initialValues={initialValues} />
        </div>
      </main>
    </div>
  );
}
