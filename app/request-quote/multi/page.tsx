import type { Metadata } from "next";
import { CustomerJourneyApp } from "@/components/customer-journey/customer-journey-app";
import { getInitialProfileIdForRequestQuoteRoute } from "@/lib/customer-journey/journey-routes";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";

export const metadata: Metadata = {
  title: "Request a Quote — Multi-Trade Preview",
  description: "Temporary preview route for a multi-trade customer enquiry.",
};

export default function RequestQuoteMultiPage() {
  return (
    <CustomerJourneyApp
      initialProfileId={getInitialProfileIdForRequestQuoteRoute("multi")}
      devPreviewEnabled={isDevTestingEnabled()}
    />
  );
}
