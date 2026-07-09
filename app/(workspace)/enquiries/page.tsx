import type { Metadata } from "next";
import { EnquiriesBrowser } from "@/components/enquiries/enquiries-browser";

export const metadata: Metadata = {
  title: "Enquiries — QuoteForge",
  description: "Review new customer enquiries from your quote request journey.",
};

export default function EnquiriesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Enquiries
      </h1>
      <p className="mt-2 text-sm text-muted">
        New customer requests from your quote journey. Saved locally in this
        browser for now.
      </p>

      <div className="mt-8">
        <EnquiriesBrowser />
      </div>
    </main>
  );
}
