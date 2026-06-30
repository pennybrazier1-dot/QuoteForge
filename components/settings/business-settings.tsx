import {
  SettingsField,
  SettingsSection,
} from "@/components/settings/settings-section";

export type BusinessSettingsData = {
  business_name: string;
  trade_type: string | null;
  contact_email: string | null;
  phone: string | null;
  vat_number: string | null;
  default_payment_terms: string;
};

export function BusinessSettings({ workspace }: { workspace: BusinessSettingsData }) {
  return (
    <SettingsSection
      title="Business Settings"
      description="Your business details used on proposals and customer records."
    >
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <SettingsField label="Business name" value={workspace.business_name} />
        <SettingsField label="Trade type" value={workspace.trade_type} />
        <SettingsField label="Business email" value={workspace.contact_email} />
        <SettingsField label="Phone number" value={workspace.phone} />
        <SettingsField label="VAT number" value={workspace.vat_number} />
        <SettingsField
          label="Default payment terms"
          value={workspace.default_payment_terms}
          className="sm:col-span-2"
        />
      </dl>
    </SettingsSection>
  );
}
