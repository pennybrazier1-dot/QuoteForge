"use client";

import { useJourney } from "@/lib/customer-journey/journey-provider";
import { BoltIcon, LockIcon } from "@/components/customer-journey/ui/journey-icons";

export function JourneyFooter() {
  const { tradesperson } = useJourney();

  return (
    <footer className="cj-footer">
      <div className="cj-footer-left">
        <LockIcon className="cj-footer-icon" />
        <span>Secure Form • Takes 3–5 minutes</span>
      </div>
      <div className="cj-footer-right">
        <span>Powered by</span>
        <span className="cj-footer-brand">
          <BoltIcon className="cj-footer-brand-icon" />
          {tradesperson.brandName}
        </span>
        <span className="cj-footer-tagline">Smart job management</span>
      </div>
    </footer>
  );
}
