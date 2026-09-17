import type { Metadata } from "next";
import Link from "next/link";
import { CustomerCreateForm } from "@/components/customers/customer-create-form";

export const metadata: Metadata = {
  title: "Add Customer",
  description: "Add a customer to Reanvil.",
};

export default function NewCustomerPage() {
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

      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
        Add customer
      </h1>
      <p className="mt-2 text-sm text-muted">
        Use this when you already know someone is a customer. Quotes and
        enquiries do not add people here on their own.
      </p>

      <div className="mt-8">
        <CustomerCreateForm />
      </div>
    </main>
  );
}
