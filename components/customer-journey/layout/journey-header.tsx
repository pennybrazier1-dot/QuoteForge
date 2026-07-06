"use client";

import { useJourney } from "@/lib/customer-journey/journey-provider";
import {
  BoltIcon,
  CheckShieldIcon,
  ShieldIcon,
  StarIcon,
} from "@/components/customer-journey/ui/journey-icons";

export function JourneyHeader() {
  const { tradesperson } = useJourney();

  return (
    <header className="cj-header">
      <div className="cj-header-brand">
        <div className="cj-logo">
          <BoltIcon className="cj-logo-icon" />
          <span className="cj-logo-text">{tradesperson.brandName}</span>
        </div>
        <p className="cj-header-subtitle">
          Working with{" "}
          <span className="cj-text-accent">{tradesperson.businessName}</span>
        </p>
      </div>

      <div className="cj-header-trust" aria-label="Trust indicators">
        <div className="cj-trust-item">
          <ShieldIcon className="cj-trust-icon" />
          <span>Fully Insured</span>
        </div>
        <div className="cj-trust-item">
          <CheckShieldIcon className="cj-trust-icon" />
          <span>Free Quotations</span>
        </div>
        <div className="cj-trust-item">
          <StarIcon className="cj-trust-icon" />
          <span>5★ Rated by customers</span>
        </div>
      </div>
    </header>
  );
}
