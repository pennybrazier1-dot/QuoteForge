"use client";

import { useJourney } from "@/lib/customer-journey/journey-provider";
import { getWhatHappensNext } from "@/lib/customer-journey/constants";
import { CheckIcon } from "@/components/customer-journey/ui/journey-icons";
import { JourneyCard } from "@/components/customer-journey/ui/journey-ui";

export function StepThankYou() {
  const { tradesperson } = useJourney();
  const contactMatchesBusiness =
    tradesperson.contactName.trim().toLowerCase() ===
    tradesperson.businessName.trim().toLowerCase();
  const whoWillContact = contactMatchesBusiness
    ? tradesperson.businessName
    : `${tradesperson.contactName} at ${tradesperson.businessName}`;
  const nextSteps = getWhatHappensNext(tradesperson.contactName);

  return (
    <div className="cj-thankyou cj-step-animate">
      <div className="cj-thankyou-icon-wrap">
        <CheckIcon className="cj-thankyou-icon" />
      </div>
      <h1 className="cj-thankyou-title">Your request has been sent</h1>
      <p className="cj-thankyou-lead">
        We&apos;ve received your enquiry and your tradesperson will review it
        shortly. {whoWillContact} will be in touch using the contact details you
        provided.
      </p>

      <JourneyCard inset className="cj-thankyou-card">
        <h2 className="cj-thankyou-card-title">What happens next</h2>
        <ul className="cj-thankyou-list">
          {nextSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
          <li>No account needed — we&apos;ll keep you updated</li>
        </ul>
      </JourneyCard>

      {tradesperson.phone.trim() ? (
        <p className="cj-thankyou-footer">
          Need to speak to someone now? Call{" "}
          <a href={`tel:${tradesperson.phone}`} className="cj-text-accent">
            {tradesperson.phone}
          </a>
        </p>
      ) : null}
    </div>
  );
}
