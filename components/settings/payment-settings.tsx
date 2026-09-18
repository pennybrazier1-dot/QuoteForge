"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
import { SettingsSection } from "@/components/settings/settings-section";
import {
  savePaymentSettingsAction,
  type PaymentActionState,
} from "@/lib/payments/actions";
import type { WorkspacePaymentSettings } from "@/lib/payments/types";

const initialState: PaymentActionState = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save payments"}
    </button>
  );
}

function MethodToggle({
  name,
  label,
  defaultChecked,
  hint,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  hint?: string;
}) {
  return (
    <label className="qf-payment-method-toggle">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span>
        <span className="qf-payment-method-label">{label}</span>
        {hint ? <span className="qf-payment-method-hint">{hint}</span> : null}
      </span>
    </label>
  );
}

export function PaymentSettings({
  settings,
}: {
  settings: WorkspacePaymentSettings;
}) {
  const [state, action] = useActionState(savePaymentSettingsAction, initialState);

  return (
    <SettingsSection
      title="Payments"
      description="Choose how customers can pay. Bank details stay private until you send a payment request."
    >
      <form action={action} className="qf-payment-settings-form">
        {state.error ? <AuthError message={state.error} /> : null}
        {state.success ? (
          <p className="qf-workspace-actions-success" role="status">
            Payment settings saved
          </p>
        ) : null}

        <fieldset className="qf-payment-methods">
          <legend className="qf-field-label">Accepted methods</legend>
          <MethodToggle
            name="accept_bank_transfer"
            label="Bank transfer"
            defaultChecked={settings.accept_bank_transfer}
          />
          <MethodToggle
            name="accept_card_link"
            label="Card payment link"
            hint="A secure link from Stripe, Square, SumUp or similar. Reanvil never stores card numbers."
            defaultChecked={settings.accept_card_link}
          />
          <MethodToggle
            name="accept_card_in_person"
            label="Card in person"
            defaultChecked={settings.accept_card_in_person}
          />
          <MethodToggle
            name="accept_cash"
            label="Cash"
            defaultChecked={settings.accept_cash}
          />
          <MethodToggle
            name="accept_other"
            label="Other"
            defaultChecked={settings.accept_other}
          />
        </fieldset>

        <div className="qf-payment-settings-fields">
          <label className="qf-completed-jobs-search">
            <span className="qf-field-label">Account name</span>
            <input
              className="form-input"
              name="bank_account_name"
              defaultValue={settings.bank_account_name ?? ""}
              autoComplete="off"
            />
          </label>
          <label className="qf-completed-jobs-search">
            <span className="qf-field-label">Sort code</span>
            <input
              className="form-input"
              name="bank_sort_code"
              defaultValue={settings.bank_sort_code ?? ""}
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          <label className="qf-completed-jobs-search">
            <span className="qf-field-label">Account number</span>
            <input
              className="form-input"
              name="bank_account_number"
              defaultValue={settings.bank_account_number ?? ""}
              inputMode="numeric"
              autoComplete="off"
            />
          </label>
          <label className="qf-completed-jobs-search">
            <span className="qf-field-label">Payment reference</span>
            <input
              className="form-input"
              name="bank_reference_instructions"
              defaultValue={settings.bank_reference_instructions ?? ""}
              placeholder="Use your surname or job reference"
            />
          </label>
          <label className="qf-completed-jobs-search">
            <span className="qf-field-label">Card payment link</span>
            <input
              className="form-input"
              name="external_payment_url"
              type="url"
              defaultValue={settings.external_payment_url ?? ""}
              placeholder="https://"
            />
          </label>
          <label className="qf-completed-jobs-search">
            <span className="qf-field-label">Other method label</span>
            <input
              className="form-input"
              name="other_method_label"
              defaultValue={settings.other_method_label ?? ""}
            />
          </label>
        </div>

        <SaveButton />
      </form>
    </SettingsSection>
  );
}
