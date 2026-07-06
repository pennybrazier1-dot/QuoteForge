import type { Metadata } from "next";
import { CustomerJourneyApp } from "@/components/customer-journey/customer-journey-app";
import { getInitialProfileIdForRequestQuoteRoute } from "@/lib/customer-journey/journey-routes";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";

export const metadata: Metadata = {
  title: "Request a Quote — Handyman Preview",
  description: "Temporary preview route for a handyman customer enquiry.",
};

export default function RequestQuoteHandymanPage() {
  return (
    <CustomerJourneyApp
      initialProfileId={getInitialProfileIdForRequestQuoteRoute("handyman")}
      devPreviewEnabled={isDevTestingEnabled()}
    />
  );
}
