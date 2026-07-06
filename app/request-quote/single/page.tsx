import type { Metadata } from "next";
import { CustomerJourneyApp } from "@/components/customer-journey/customer-journey-app";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";

export const metadata: Metadata = {
  title: "Request a Quote — Single Trade Preview",
  description: "Temporary preview route for a single-trade customer enquiry.",
};

export default function RequestQuoteSinglePage() {
  return (
    <CustomerJourneyApp
      initialProfileId="single-trade"
      devPreviewEnabled={isDevTestingEnabled()}
    />
  );
}
