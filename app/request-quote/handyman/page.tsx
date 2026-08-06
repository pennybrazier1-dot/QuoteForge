import type { Metadata } from "next";
import { CustomerJourneyApp } from "@/components/customer-journey/customer-journey-app";
import { assertCustomerJourneyDemoAccess } from "@/lib/customer-journey/assert-demo-access";
import { getInitialProfileIdForRequestQuoteRoute } from "@/lib/customer-journey/journey-routes";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";

export const metadata: Metadata = {
  title: "Customer enquiry demo — Handyman",
  description: "Testing-only preview of a handyman customer enquiry form.",
};

export default async function RequestQuoteHandymanPage() {
  await assertCustomerJourneyDemoAccess();

  return (
    <CustomerJourneyApp
      initialProfileId={getInitialProfileIdForRequestQuoteRoute("handyman")}
      devPreviewEnabled={isDevTestingEnabled()}
    />
  );
}
