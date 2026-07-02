"use client";

import type { ReactNode } from "react";
import type { GeneratedProposal } from "@/lib/ai";
import {
  arrayToLines,
  linesToArray,
} from "@/lib/proposals/proposal-form-helpers";
import { SectionCard } from "@/components/ui/section-card";
import { PlannedStartDateFields } from "@/components/proposals/planned-start-date-fields";

function ReviewField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="qf-field-label">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ReviewTextarea({
  id,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="form-textarea"
    />
  );
}

export function EditableProposalReview({
  proposal,
  onProposalChange,
  customerName,
  onCustomerNameChange,
  propertyAddress,
  onPropertyAddressChange,
  phoneNumber,
  onPhoneNumberChange,
  emailAddress,
  onEmailAddressChange,
  estimatedPrice,
  onEstimatedPriceChange,
  plannedStartDateText,
  onPlannedStartDateTextChange,
  plannedStartDateExact,
  onPlannedStartDateExactChange,
}: {
  proposal: GeneratedProposal;
  onProposalChange: (proposal: GeneratedProposal) => void;
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  propertyAddress: string;
  onPropertyAddressChange: (value: string) => void;
  phoneNumber: string;
  onPhoneNumberChange: (value: string) => void;
  emailAddress: string;
  onEmailAddressChange: (value: string) => void;
  estimatedPrice: string;
  onEstimatedPriceChange: (value: string) => void;
  plannedStartDateText: string;
  onPlannedStartDateTextChange: (value: string) => void;
  plannedStartDateExact: string;
  onPlannedStartDateExactChange: (value: string) => void;
}) {
  const updateProposal = (patch: Partial<GeneratedProposal>) => {
    onProposalChange({
      ...proposal,
      ...patch,
    });
  };

  return (
    <div className="qf-editable-proposal-review space-y-4">
      <SectionCard className="qf-card-form">
        <h2 className="qf-card-heading">Customer</h2>
        <div className="mt-4">
          <ReviewField label="Customer name" id="reviewCustomerName">
            <input
              id="reviewCustomerName"
              name="customerName"
              type="text"
              value={customerName}
              onChange={(event) => onCustomerNameChange(event.target.value)}
              placeholder="e.g. Mrs Sarah Whitfield"
              className="form-input"
              required
            />
          </ReviewField>
        </div>
      </SectionCard>

      <SectionCard className="qf-card-form">
        <h2 className="qf-card-heading">Address</h2>
        <div className="mt-4">
          <ReviewField label="Property address" id="reviewPropertyAddress">
            <input
              id="reviewPropertyAddress"
              name="propertyAddress"
              type="text"
              value={propertyAddress}
              onChange={(event) => onPropertyAddressChange(event.target.value)}
              placeholder="e.g. 14 Riverside Close, Bristol"
              className="form-input"
            />
          </ReviewField>
        </div>
      </SectionCard>

      <SectionCard className="qf-card-form">
        <h2 className="qf-card-heading">Contact</h2>
        <div className="mt-4 grid gap-4">
          <ReviewField label="Phone" id="reviewPhoneNumber">
            <input
              id="reviewPhoneNumber"
              name="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(event) => onPhoneNumberChange(event.target.value)}
              autoComplete="tel"
              placeholder="e.g. 07700 900123"
              className="form-input"
            />
          </ReviewField>
          <ReviewField label="Email" id="reviewEmailAddress">
            <input
              id="reviewEmailAddress"
              name="emailAddress"
              type="email"
              value={emailAddress}
              onChange={(event) => onEmailAddressChange(event.target.value)}
              autoComplete="email"
              placeholder="e.g. sarah@example.com"
              className="form-input"
            />
          </ReviewField>
        </div>
      </SectionCard>

      <SectionCard className="qf-card-form">
        <h2 className="qf-card-heading">Job Summary</h2>
        <div className="mt-4">
          <ReviewTextarea
            id="reviewJobSummary"
            value={proposal.jobSummary}
            onChange={(value) => updateProposal({ jobSummary: value })}
            rows={4}
          />
        </div>
      </SectionCard>

      <SectionCard className="qf-card-form">
        <h2 className="qf-card-heading">Scope</h2>
        <div className="mt-4">
          <ReviewTextarea
            id="reviewScope"
            value={arrayToLines(proposal.scopeOfWork)}
            onChange={(value) =>
              updateProposal({ scopeOfWork: linesToArray(value) })
            }
            rows={5}
            placeholder="One item per line"
          />
        </div>
      </SectionCard>

      <SectionCard className="qf-card-form">
        <h2 className="qf-card-heading">Materials</h2>
        <div className="mt-4">
          <ReviewTextarea
            id="reviewMaterials"
            value={arrayToLines(proposal.materials)}
            onChange={(value) =>
              updateProposal({ materials: linesToArray(value) })
            }
            rows={5}
            placeholder="One item per line"
          />
        </div>
      </SectionCard>

      <SectionCard className="qf-card-form">
        <h2 className="qf-card-heading">Materials Status</h2>
        <p className="qf-body-text mt-4 text-muted">
          Materials tracking will be added later.
        </p>
      </SectionCard>

      <SectionCard className="qf-card-form">
        <h2 className="qf-card-heading">Labour</h2>
        <div className="mt-4">
          <ReviewTextarea
            id="reviewLabour"
            value={proposal.labour}
            onChange={(value) => updateProposal({ labour: value })}
            rows={4}
          />
        </div>
      </SectionCard>

      <SectionCard className="qf-card-form">
        <h2 className="qf-card-heading">Optional Extras</h2>
        <div className="mt-4">
          <ReviewTextarea
            id="reviewOptionalExtras"
            value={arrayToLines(proposal.optionalExtras)}
            onChange={(value) =>
              updateProposal({ optionalExtras: linesToArray(value) })
            }
            rows={4}
            placeholder="One optional extra per line"
          />
        </div>
      </SectionCard>

      <SectionCard className="qf-card-form">
        <h2 className="qf-card-heading">Price</h2>
        <div className="mt-4">
          <ReviewField label="Estimated price" id="reviewEstimatedPrice">
            <div className="qf-price-input">
              <span className="qf-price-prefix" aria-hidden="true">
                £
              </span>
              <input
                id="reviewEstimatedPrice"
                name="estimatedPrice"
                type="text"
                inputMode="decimal"
                value={estimatedPrice}
                onChange={(event) => onEstimatedPriceChange(event.target.value)}
                placeholder="e.g. 850"
                className="form-input"
              />
            </div>
          </ReviewField>
        </div>
      </SectionCard>

      <SectionCard className="qf-card-form">
        <h2 className="qf-card-heading">Job Timing</h2>
        <div className="mt-4 space-y-5">
          <PlannedStartDateFields
            textValue={plannedStartDateText}
            exactValue={plannedStartDateExact}
            onTextChange={(value) => {
              onPlannedStartDateTextChange(value);
              updateProposal({ plannedStartDate: value });
            }}
            onExactChange={(value) => {
              onPlannedStartDateExactChange(value);
              updateProposal({ plannedStartDateExact: value });
            }}
          />

          <ReviewField label="Estimated duration" id="reviewEstimatedDuration">
            <input
              type="hidden"
              name="estimatedDuration"
              value={proposal.estimatedDuration}
            />
            <input
              id="reviewEstimatedDuration"
              type="text"
              value={proposal.estimatedDuration}
              onChange={(event) =>
                updateProposal({ estimatedDuration: event.target.value })
              }
              placeholder="e.g. 2 days, half a day, approximately 3 days depending on weather"
              className="form-input"
            />
          </ReviewField>
        </div>
      </SectionCard>

      <SectionCard className="qf-card-form">
        <h2 className="qf-card-heading">Things to Confirm</h2>
        <div className="mt-4">
          <ReviewTextarea
            id="reviewThingsToConfirm"
            value={arrayToLines(proposal.thingsToConfirm)}
            onChange={(value) =>
              updateProposal({ thingsToConfirm: linesToArray(value) })
            }
            rows={5}
            placeholder="One item per line"
          />
        </div>
      </SectionCard>
    </div>
  );
}
