"use client";

import { JourneyProvider } from "@/lib/customer-journey/journey-provider";
import { CustomerJourneyShell } from "@/components/customer-journey/customer-journey-shell";
import { JourneyPreviewSwitcher } from "@/components/customer-journey/journey-preview-switcher";

type CustomerJourneyAppProps = {
  devPreviewEnabled?: boolean;
};

export function CustomerJourneyApp({
  devPreviewEnabled = false,
}: CustomerJourneyAppProps) {
  return (
    <JourneyProvider>
      <CustomerJourneyShell />
      {devPreviewEnabled ? <JourneyPreviewSwitcher /> : null}
    </JourneyProvider>
  );
}
