"use client";

import { useActionState, useState } from "react";
import {
  saveDraftProposal,
  updateDraftProposal,
  type SaveDraftProposalState,
} from "@/app/proposals/actions";
import {
  generateProposalDraft,
  type GenerateProposalState,
} from "@/app/proposals/generate-actions";
import { AuthError } from "@/components/auth/auth-shell";
import { ProposalField, ProposalTextarea } from "@/components/proposals/field";
import { GenerateProposalButton } from "@/components/proposals/generate-proposal-button";
import { GeneratedProposalPreview } from "@/components/proposals/generated-proposal-preview";
import { SaveDraftButton } from "@/components/proposals/save-draft-button";
import { ProposalSection } from "@/components/proposals/section";
import type { ProposalFormValues } from "@/lib/proposals/form-values";

const saveInitialState: SaveDraftProposalState = {};
const generateInitialState: GenerateProposalState = {};

const SITE_NOTES_HELPER =
  "Write your site notes just as you would on paper. Include the work required, any materials or products discussed, measurements, customer requests, access issues, estimated price or duration if you already know them, and anything that still needs confirming.";

const OPTIONAL_EXTRAS_HELPER =
  "Add possible extra work you noticed on site that is not part of the main quote yet.";

type ProposalStudioFormProps = {
  mode?: "create" | "edit";
  proposalId?: string;
  initialValues?: ProposalFormValues;
};

export function ProposalStudioForm({
  mode = "create",
  proposalId,
  initialValues,
}: ProposalStudioFormProps) {
  const saveAction = mode === "edit" ? updateDraftProposal : saveDraftProposal;
  const [saveState, formAction] = useActionState(saveAction, saveInitialState);
  const [generateState, generateAction] = useActionState(
    generateProposalDraft,
    generateInitialState
  );

  const [customerName, setCustomerName] = useState(
    initialValues?.customerName ?? ""
  );
  const [propertyAddress, setPropertyAddress] = useState(
    initialValues?.propertyAddress ?? ""
  );
  const [phoneNumber, setPhoneNumber] = useState(
    initialValues?.phoneNumber ?? ""
  );
  const [emailAddress, setEmailAddress] = useState(
    initialValues?.emailAddress ?? ""
  );
  const [jobDescription, setJobDescription] = useState(
    initialValues?.jobDescription ?? ""
  );
  const [optionalExtras, setOptionalExtras] = useState(
    initialValues?.optionalExtras ?? ""
  );
  const [estimatedPrice, setEstimatedPrice] = useState(
    initialValues?.estimatedPrice ?? ""
  );
  const [estimatedDuration, setEstimatedDuration] = useState(
    initialValues?.estimatedDuration ?? ""
  );

  const saveHelperText =
    mode === "edit"
      ? "Updates your draft. You can review it on the proposal page when you are done."
      : "Saves your site notes as a draft. The AI draft above is not saved yet.";

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && proposalId ? (
        <input type="hidden" name="proposalId" value={proposalId} />
      ) : null}

      {saveState.error ? <AuthError message={saveState.error} /> : null}

      <ProposalSection title="Customer Information">
        <ProposalField
          label="Customer name"
          id="customerName"
          name="customerName"
          value={customerName}
          onChange={setCustomerName}
          placeholder="e.g. Mrs Sarah Whitfield"
          required
        />
        <ProposalField
          label="Property address"
          id="propertyAddress"
          name="propertyAddress"
          value={propertyAddress}
          onChange={setPropertyAddress}
          placeholder="e.g. 14 Riverside Close, Bristol"
        />
        <ProposalField
          label="Phone number"
          id="phoneNumber"
          name="phoneNumber"
          type="tel"
          value={phoneNumber}
          onChange={setPhoneNumber}
          autoComplete="tel"
          placeholder="e.g. 07700 900123"
        />
        <ProposalField
          label="Email address"
          id="emailAddress"
          name="emailAddress"
          type="email"
          value={emailAddress}
          onChange={setEmailAddress}
          autoComplete="email"
          placeholder="e.g. sarah@example.com"
        />
      </ProposalSection>

      <ProposalSection title="Site Notes">
        <p className="text-sm text-muted">{SITE_NOTES_HELPER}</p>
        <ProposalTextarea
          label="Site Notes"
          id="jobDescription"
          name="jobDescription"
          value={jobDescription}
          onChange={setJobDescription}
          rows={8}
          required
          placeholder="e.g. Replace 12m fence, concrete posts, gravel boards. Customer wants same height. Tight access down side path. Quote around £850, about 2 days. Need to confirm post spacing and disposal."
        />

        <p className="text-sm text-muted">{OPTIONAL_EXTRAS_HELPER}</p>
        <ProposalTextarea
          label="Optional Extras"
          id="optionalExtras"
          name="optionalExtras"
          value={optionalExtras}
          onChange={setOptionalExtras}
          rows={4}
          placeholder="e.g. Outside socket while on site — separate price"
        />

        {generateState.error ? (
          <AuthError message={generateState.error} />
        ) : null}

        {generateState.proposal ? (
          <GeneratedProposalPreview proposal={generateState.proposal} />
        ) : null}
      </ProposalSection>

      <ProposalSection title="Estimate">
        <p className="text-sm text-muted">
          If you already know the price or duration, enter it here. These fields
          override anything mentioned in your site notes.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <ProposalField
            label="Estimated price"
            id="estimatedPrice"
            name="estimatedPrice"
            value={estimatedPrice}
            onChange={setEstimatedPrice}
            placeholder="e.g. 850"
          />
          <ProposalField
            label="Estimated duration"
            id="estimatedDuration"
            name="estimatedDuration"
            value={estimatedDuration}
            onChange={setEstimatedDuration}
            placeholder="e.g. 1 day or 3 hours"
          />
        </div>
      </ProposalSection>

      <div className="space-y-3 pt-2">
        <GenerateProposalButton formAction={generateAction} />
        <p className="text-center text-xs text-muted">
          Organises your site notes into a proposal draft. Review it carefully
          before sending anything to a customer.
        </p>
      </div>

      <div className="space-y-3 border-t border-border-subtle pt-6">
        <SaveDraftButton label="Save Draft" />
        <p className="text-center text-xs text-muted">{saveHelperText}</p>
      </div>
    </form>
  );
}
