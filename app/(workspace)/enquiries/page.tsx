import type { Metadata } from "next";
import { EnquiriesBrowser } from "@/components/enquiries/enquiries-browser";

export const metadata: Metadata = {
  title: "Enquiries",
  description:
    "Review new customer requests submitted through your public quote link.",
};

export default function EnquiriesPage() {
  return (
    <main className="qf-trader-page mx-auto w-full max-w-full flex-1 py-8 sm:py-10 lg:max-w-6xl lg:px-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Enquiries
      </h1>
      <p className="mt-2 text-sm text-muted">
        Incoming customer requests for your business. Share your public quote
        link from Settings — customers fill that form, and new enquiries land
        here.
      </p>

      <div className="mt-8">
        <EnquiriesBrowser />
      </div>
    </main>
  );
}
