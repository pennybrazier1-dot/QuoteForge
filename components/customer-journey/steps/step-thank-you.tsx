"use client";

import { useJourney } from "@/lib/customer-journey/journey-provider";
import { CheckIcon } from "@/components/customer-journey/ui/journey-icons";
import { JourneyCard } from "@/components/customer-journey/ui/journey-ui";

export function StepThankYou() {
  const { tradesperson } = useJourney();

  return (
    <div className="cj-thankyou cj-step-animate">
      <div className="cj-thankyou-icon-wrap">
        <CheckIcon className="cj-thankyou-icon" />
      </div>
      <h1 className="cj-thankyou-title">You&apos;re all done</h1>
      <p className="cj-thankyou-lead">
        Thanks — your request is with {tradesperson.contactName} at{" "}
        {tradesperson.businessName}. He&apos;ll review what you&apos;ve shared
        and be in touch soon.
      </p>

      <JourneyCard inset className="cj-thankyou-card">
        <h2 className="cj-thankyou-card-title">What happens next</h2>
        <ul className="cj-thankyou-list">
          <li>John will review your request — usually within one working day</li>
          <li>He&apos;ll call or text you on the number you provided</li>
          <li>No account needed — we&apos;ll keep you updated</li>
        </ul>
      </JourneyCard>

      <p className="cj-thankyou-footer">
        Need to speak to someone now? Call{" "}
        <a href={`tel:${tradesperson.phone}`} className="cj-text-accent">
          {tradesperson.phone}
        </a>
      </p>
    </div>
  );
}
