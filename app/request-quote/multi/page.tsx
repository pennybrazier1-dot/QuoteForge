import type { Metadata } from "next";
import { CustomerJourneyApp } from "@/components/customer-journey/customer-journey-app";
import { assertCustomerJourneyDemoAccess } from "@/lib/customer-journey/assert-demo-access";
import { getInitialProfileIdForRequestQuoteRoute } from "@/lib/customer-journey/journey-routes";
import { isDevTestingEnabled } from "@/lib/env/dev-testing";

export const metadata: Metadata = {
  title: "Customer enquiry demo — Multi-trade",
  description: "Testing-only preview of a multi-trade customer enquiry form.",
};

export default async function RequestQuoteMultiPage() {
  await assertCustomerJourneyDemoAccess();

  return (
    <CustomerJourneyApp
      initialProfileId={getInitialProfileIdForRequestQuoteRoute("multi")}
      devPreviewEnabled={isDevTestingEnabled()}
    />
  );
}
