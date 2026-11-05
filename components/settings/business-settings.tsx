"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AuthError } from "@/components/auth/auth-shell";
import { SettingsSection } from "@/components/settings/settings-section";
import { TRADE_TYPES } from "@/lib/onboarding/constants";
import { WORKSPACE_LOGO_MAX_BYTES } from "@/lib/workspace/branding-logo";
import {
  removeBusinessLogoAction,
  saveBusinessProfileAction,
  uploadBusinessLogoAction,
  type BusinessProfileActionState,
} from "@/lib/workspace/actions";

export type BusinessSettingsData = {
  business_name: string;
  trade_type: string | null;
  contact_email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  vat_number: string | null;
  website: string | null;
  company_number: string | null;
  default_payment_terms: string;
};

const initialState: BusinessProfileActionState = {};

function SaveDetailsButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save business details"}
    </button>
  );
}

function UploadLogoButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-primary" disabled={pending}>
      {pending ? "Uploading…" : "Upload logo"}
    </button>
  );
}

function RemoveLogoButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="qf-btn-secondary" disabled={pending}>
      {pending ? "Removing…" : "Remove logo"}
    </button>
  );
}

export function BusinessSettings({
  workspace,
  logoPreviewUrl,
}: {
  workspace: BusinessSettingsData;
  logoPreviewUrl: string | null;
}) {
  const [detailsState, detailsAction] = useActionState(
    saveBusinessProfileAction,
    initialState
  );
  const [logoState, logoAction] = useActionState(
    uploadBusinessLogoAction,
    initialState
  );
  const [removeState, removeAction] = useActionState(
    removeBusinessLogoAction,
    initialState
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [clientLogoError, setClientLogoError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const shownLogo = preview || logoPreviewUrl;

  return (
    <SettingsSection
      title="Business Settings"
      description="These details appear on quotes, invoices and customer messages. Bank details stay in Payments."
    >
      <form action={detailsAction} className="qf-business-settings-form">
        {detailsState.error ? <AuthError message={detailsState.error} /> : null}
        {detailsState.success ? (
          <p className="qf-workspace-actions-success" role="status">
            {detailsState.success}
          </p>
        ) : null}

        <div className="qf-business-settings-grid">
          <label className="qf-field">
            <span className="qf-field-label">Business name</span>
            <input
              className="form-input"
              name="businessName"
              required
              defaultValue={workspace.business_name}
              autoComplete="organization"
            />
          </label>

          <label className="qf-field">
            <span className="qf-field-label">Trade type</span>
            <select
              className="form-input"
              name="tradeType"
              required
              defaultValue={workspace.trade_type ?? ""}
            >
              <option value="" disabled>
                Select trade
              </option>
              {TRADE_TYPES.map((trade) => (
                <option key={trade} value={trade}>
                  {trade}
                </option>
              ))}
            </select>
          </label>

          <label className="qf-field">
            <span className="qf-field-label">Business email</span>
            <input
              className="form-input"
              type="email"
              name="contactEmail"
              required
              defaultValue={workspace.contact_email ?? ""}
              autoComplete="email"
            />
          </label>

          <label className="qf-field">
            <span className="qf-field-label">Phone number</span>
            <input
              className="form-input"
              type="tel"
              name="phone"
              required
              defaultValue={workspace.phone ?? ""}
              autoComplete="tel"
              placeholder="07…"
            />
          </label>

          <label className="qf-field qf-business-settings-span2">
            <span className="qf-field-label">Address line 1</span>
            <input
              className="form-input"
              name="addressLine1"
              defaultValue={workspace.address_line_1 ?? ""}
              autoComplete="address-line1"
            />
          </label>

          <label className="qf-field qf-business-settings-span2">
            <span className="qf-field-label">Address line 2 (optional)</span>
            <input
              className="form-input"
              name="addressLine2"
              defaultValue={workspace.address_line_2 ?? ""}
              autoComplete="address-line2"
            />
          </label>

          <label className="qf-field">
            <span className="qf-field-label">Town / city</span>
            <input
              className="form-input"
              name="town"
              defaultValue={workspace.town ?? ""}
              autoComplete="address-level2"
            />
          </label>

          <label className="qf-field">
            <span className="qf-field-label">County (optional)</span>
            <input
              className="form-input"
              name="county"
              defaultValue={workspace.county ?? ""}
              autoComplete="address-level1"
            />
          </label>

          <label className="qf-field">
            <span className="qf-field-label">Postcode</span>
            <input
              className="form-input"
              name="postcode"
              defaultValue={workspace.postcode ?? ""}
              autoComplete="postal-code"
              placeholder="e.g. NN1 1AA"
            />
          </label>

          <label className="qf-field">
            <span className="qf-field-label">VAT number (optional)</span>
            <input
              className="form-input"
              name="vatNumber"
              defaultValue={workspace.vat_number ?? ""}
              placeholder="GB123456789"
            />
          </label>

          <label className="qf-field">
            <span className="qf-field-label">Website (optional)</span>
            <input
              className="form-input"
              type="text"
              name="website"
              defaultValue={workspace.website ?? ""}
              placeholder="https://www.example.co.uk"
              autoComplete="url"
              inputMode="url"
            />
          </label>

          <label className="qf-field">
            <span className="qf-field-label">
              Company registration number (optional)
            </span>
            <input
              className="form-input"
              name="companyNumber"
              defaultValue={workspace.company_number ?? ""}
              placeholder="12345678"
              autoComplete="off"
            />
          </label>

          <label className="qf-field qf-business-settings-span2">
            <span className="qf-field-label">Default payment terms</span>
            <textarea
              className="form-input"
              name="defaultPaymentTerms"
              required
              rows={3}
              defaultValue={workspace.default_payment_terms}
            />
          </label>
        </div>

        <p className="qf-quote-prep-helper">
          Website and company number are optional — leave blank if you are a
          sole trader or do not have a site. Leave VAT blank if you are not VAT
          registered.
        </p>

        <SaveDetailsButton />
      </form>

      <div className="qf-business-logo-block">
        <h3 className="qf-business-logo-heading">Business logo</h3>
        <p className="qf-quote-prep-helper">
          JPEG, PNG or WebP up to 2 MB. Used on quote and invoice PDFs. Leave
          empty for a clean name-only document header.
        </p>

        {clientLogoError ? <AuthError message={clientLogoError} /> : null}
        {logoState.error ? <AuthError message={logoState.error} /> : null}
        {removeState.error ? <AuthError message={removeState.error} /> : null}
        {logoState.success || removeState.success ? (
          <p className="qf-workspace-actions-success" role="status">
            {logoState.success || removeState.success}
          </p>
        ) : null}

        <div className="qf-business-logo-preview" aria-live="polite">
          {shownLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownLogo} alt="Business logo preview" />
          ) : (
            <p className="qf-business-logo-empty">No logo uploaded</p>
          )}
        </div>

        <form
          action={logoAction}
          className="qf-business-logo-upload"
          onSubmit={(event) => {
            const fileInput = event.currentTarget.elements.namedItem(
              "logo"
            ) as HTMLInputElement | null;
            const file = fileInput?.files?.[0];
            if (!file) {
              return;
            }
            if (file.size > WORKSPACE_LOGO_MAX_BYTES) {
              event.preventDefault();
              setClientLogoError("Logo must be 2 MB or smaller.");
              return;
            }
            setClientLogoError(null);
          }}
        >
          <label className="qf-field">
            <span className="qf-field-label">Choose logo</span>
            <input
              className="form-input"
              type="file"
              name="logo"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (preview) {
                  URL.revokeObjectURL(preview);
                }
                if (file && file.size > WORKSPACE_LOGO_MAX_BYTES) {
                  setClientLogoError("Logo must be 2 MB or smaller.");
                  setPreview(null);
                  event.target.value = "";
                  return;
                }
                setClientLogoError(null);
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
          <UploadLogoButton />
        </form>

        {logoPreviewUrl || preview ? (
          <form
            action={removeAction}
            onSubmit={() => {
              if (preview) {
                URL.revokeObjectURL(preview);
              }
              setPreview(null);
            }}
          >
            <RemoveLogoButton />
          </form>
        ) : null}
      </div>
    </SettingsSection>
  );
}
