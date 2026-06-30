"use client";

import { useState } from "react";
import { ProposalField, ProposalTextarea } from "@/components/proposals/field";
import { ProposalSection } from "@/components/proposals/section";

export function ProposalStudioForm() {
  const [customerName, setCustomerName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [showComingSoon, setShowComingSoon] = useState(false);

  function handleGenerate() {
    setShowComingSoon(true);
  }

  return (
    <div className="space-y-6">
      <ProposalSection title="Customer Information">
        <ProposalField
          label="Customer name"
          id="customerName"
          value={customerName}
          onChange={setCustomerName}
          placeholder="e.g. Mrs Sarah Whitfield"
        />
        <ProposalField
          label="Property address"
          id="propertyAddress"
          value={propertyAddress}
          onChange={setPropertyAddress}
          placeholder="e.g. 14 Riverside Close, Bristol"
        />
        <ProposalField
          label="Phone number"
          id="phoneNumber"
          type="tel"
          value={phoneNumber}
          onChange={setPhoneNumber}
          autoComplete="tel"
          placeholder="e.g. 07700 900123"
        />
        <ProposalField
          label="Email address"
          id="emailAddress"
          type="email"
          value={emailAddress}
          onChange={setEmailAddress}
          autoComplete="email"
          placeholder="e.g. sarah@example.com"
        />
      </ProposalSection>

      <ProposalSection title="Job Information">
        <p className="text-sm text-muted">
          Tip: Don&apos;t worry about spelling or grammar. Just describe the work
          in your own words.
        </p>
        <ProposalTextarea
          label="Tell us about today's job"
          id="jobDescription"
          value={jobDescription}
          onChange={(value) => {
            setJobDescription(value);
            if (showComingSoon) setShowComingSoon(false);
          }}
          rows={8}
          placeholder="e.g. Replace bathroom mixer tap, fit thermostatic valve, check pipework under sink. Customer wants it done next week. Materials around £80, about 3 hours on site…"
        />
      </ProposalSection>

      <ProposalSection title="Estimate">
        <div className="grid gap-5 sm:grid-cols-2">
          <ProposalField
            label="Estimated price"
            id="estimatedPrice"
            value={estimatedPrice}
            onChange={setEstimatedPrice}
            placeholder="e.g. £850"
          />
          <ProposalField
            label="Estimated duration"
            id="estimatedDuration"
            value={estimatedDuration}
            onChange={setEstimatedDuration}
            placeholder="e.g. 1 day or 3 hours"
          />
        </div>
      </ProposalSection>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleGenerate}
          className="flex h-12 w-full items-center justify-center rounded-full bg-accent text-base font-semibold text-black transition-colors hover:bg-accent-hover"
        >
          Generate Proposal
        </button>

        {showComingSoon ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-center text-sm text-accent"
          >
            Proposal generation coming soon.
          </p>
        ) : null}
      </div>
    </div>
  );
}
