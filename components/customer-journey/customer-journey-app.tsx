"use client";

import type { JourneyPreviewProfileId } from "@/lib/customer-journey/constants";
import { JourneyProvider } from "@/lib/customer-journey/journey-provider";
import { CustomerJourneyShell } from "@/components/customer-journey/customer-journey-shell";
import { JourneyPreviewSwitcher } from "@/components/customer-journey/journey-preview-switcher";

type CustomerJourneyAppProps = {
  devPreviewEnabled?: boolean;
  initialProfileId?: JourneyPreviewProfileId;
};

export function CustomerJourneyApp({
  devPreviewEnabled = false,
  initialProfileId = "single-trade",
}: CustomerJourneyAppProps) {
  return (
    <JourneyProvider initialProfileId={initialProfileId}>
      <CustomerJourneyShell />
      {devPreviewEnabled ? <JourneyPreviewSwitcher /> : null}
    </JourneyProvider>
  );
}
