import type { Metadata } from "next";
import { CustomerJourneyApp } from "@/components/customer-journey/customer-journey-app";

export const metadata: Metadata = {
  title: "Request a Quote",
  description: "Tell us about your project and receive a clear, professional quote.",
};

export default function RequestQuotePage() {
  return <CustomerJourneyApp />;
}
