"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  updateCustomer,
  type UpdateCustomerState,
} from "@/app/customers/actions";
import { AuthError } from "@/components/auth/auth-shell";
import { ProposalField, ProposalTextarea } from "@/components/proposals/field";
import { ProposalSection } from "@/components/proposals/section";
import { SaveDraftButton } from "@/components/proposals/save-draft-button";
import type { CustomerFormValues } from "@/lib/customers/form-values";

const initialState: UpdateCustomerState = {};

type CustomerEditFormProps = {
  customerId: string;
  initialValues: CustomerFormValues;
};

export function CustomerEditForm({
  customerId,
  initialValues,
}: CustomerEditFormProps) {
  const [state, formAction] = useActionState(updateCustomer, initialState);
  const [name, setName] = useState(initialValues.name);
  const [email, setEmail] = useState(initialValues.email);
  const [phone, setPhone] = useState(initialValues.phone);
  const [address, setAddress] = useState(initialValues.address);
  const [notes, setNotes] = useState(initialValues.notes);

  return (
    <form action={formAction} className="qf-stack">
      <input type="hidden" name="customerId" value={customerId} />

      {state.error ? <AuthError message={state.error} /> : null}

      <ProposalSection title="Customer details">
        <ProposalField
          label="Customer name"
          id="name"
          name="name"
          value={name}
          onChange={setName}
          placeholder="e.g. Mrs Sarah Whitfield"
          required
        />
        <ProposalField
          label="Email address"
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="e.g. sarah@example.com"
        />
        <ProposalField
          label="Phone number"
          id="phone"
          name="phone"
          type="tel"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          placeholder="e.g. 07700 900123"
        />
        <ProposalField
          label="Address"
          id="address"
          name="address"
          value={address}
          onChange={setAddress}
          placeholder="e.g. 14 Riverside Close, Bristol, BS1 4AA"
        />
      </ProposalSection>

      <ProposalSection title="Notes">
        <ProposalTextarea
          label="Customer notes"
          id="notes"
          name="notes"
          value={notes}
          onChange={setNotes}
          rows={6}
          placeholder="e.g. Prefers morning visits. Has a dog in the back garden."
        />
        <p className="text-sm text-muted">
          Private notes about this customer. Only your workspace can see them.
        </p>
      </ProposalSection>

      <SaveDraftButton label="Save Customer" />

      <Link
        href={`/customers/${customerId}`}
        className="flex h-12 w-full items-center justify-center rounded-full border border-border-subtle bg-white/5 text-base font-medium text-foreground transition-colors hover:bg-white/10"
      >
        Cancel
      </Link>
    </form>
  );
}
