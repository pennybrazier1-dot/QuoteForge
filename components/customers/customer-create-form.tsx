"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  createCustomer,
  type CreateCustomerState,
} from "@/app/customers/actions";
import { AuthError } from "@/components/auth/auth-shell";
import { ProposalField, ProposalTextarea } from "@/components/proposals/field";
import { ProposalSection } from "@/components/proposals/section";
import { SaveDraftButton } from "@/components/proposals/save-draft-button";

const initialState: CreateCustomerState = {};

export function CustomerCreateForm() {
  const [state, formAction] = useActionState(createCustomer, initialState);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form action={formAction} className="qf-stack">
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
          rows={5}
          placeholder="Optional private notes."
        />
      </ProposalSection>

      <SaveDraftButton label="Add customer" />

      <Link
        href="/customers"
        className="flex h-12 w-full items-center justify-center rounded-full border border-border-subtle bg-white/5 text-base font-medium text-foreground transition-colors hover:bg-white/10"
      >
        Cancel
      </Link>
    </form>
  );
}
