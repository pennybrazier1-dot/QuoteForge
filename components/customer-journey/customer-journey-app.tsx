"use client";

import { JourneyProvider } from "@/lib/customer-journey/journey-provider";
import { CustomerJourneyShell } from "@/components/customer-journey/customer-journey-shell";

export function CustomerJourneyApp() {
  return (
    <JourneyProvider>
      <CustomerJourneyShell />
    </JourneyProvider>
  );
}
