"use client";

import { useActionState, useState } from "react";
import {
  saveDraftProposal,
  updateDraftProposal,
  type SaveDraftProposalState,
} from "@/app/proposals/actions";
import { AuthError } from "@/components/auth/auth-shell";
import { ProposalField, ProposalTextarea } from "@/components/proposals/field";
import { SaveDraftButton } from "@/components/proposals/save-draft-button";
import { ProposalSection } from "@/components/proposals/section";
import type { ProposalFormValues } from "@/lib/proposals/form-values";

const initialState: SaveDraftProposalState = {};

const JOB_DESCRIPTION_EXAMPLE =
  "Example: Replace 12 metres of timber fencing with concrete posts and gravel boards. Remove old fencing and dispose of all waste.";

type ProposalStudioFormProps = {
  mode?: "create" | "edit";
  proposalId?: string;
  initialValues?: ProposalFormValues;
  showJobExample?: boolean;
};

export function ProposalStudioForm({
  mode = "create",
  proposalId,
  initialValues,
  showJobExample = false,
}: ProposalStudioFormProps) {
  const action = mode === "edit" ? updateDraftProposal : saveDraftProposal;
  const [state, formAction] = useActionState(action, initialState);

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
  const [estimatedPrice, setEstimatedPrice] = useState(
    initialValues?.estimatedPrice ?? ""
  );
  const [estimatedDuration, setEstimatedDuration] = useState(
    initialValues?.estimatedDuration ?? ""
  );

  const submitLabel = "Save Draft";
  const helperText =
    mode === "edit"
      ? "Updates your draft. You can review it on the proposal page when you are done."
      : "Saves a draft you can review and finish later. AI generation is coming soon.";

  return (
    <form action={formAction} className="space-y-6">
      {mode === "edit" && proposalId ? (
        <input type="hidden" name="proposalId" value={proposalId} />
      ) : null}

      {state.error ? <AuthError message={state.error} /> : null}

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

      <ProposalSection title="Job Information">
        {showJobExample ? (
          <p className="text-sm text-muted">{JOB_DESCRIPTION_EXAMPLE}</p>
        ) : (
          <p className="text-sm text-muted">
            Tip: Don&apos;t worry about spelling or grammar. Just describe the
            work in your own words.
          </p>
        )}
        <ProposalTextarea
          label="Tell us about today's job"
          id="jobDescription"
          name="jobDescription"
          value={jobDescription}
          onChange={setJobDescription}
          rows={8}
          required
          placeholder="e.g. Replace bathroom mixer tap, fit thermostatic valve, check pipework under sink. Customer wants it done next week. Materials around £80, about 3 hours on site…"
        />
      </ProposalSection>

      <ProposalSection title="Estimate">
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

      <div className="pt-2">
        <SaveDraftButton label={submitLabel} />
        <p className="mt-3 text-center text-xs text-muted">{helperText}</p>
      </div>
    </form>
  );
}
