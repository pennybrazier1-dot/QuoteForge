import {
  SettingsField,
  SettingsSection,
} from "@/components/settings/settings-section";

export type MyAccountData = {
  full_name: string | null;
  email: string | null;
};

export function MyAccountSettings({ account }: { account: MyAccountData }) {
  return (
    <SettingsSection
      title="My Account"
      description="Your personal login details."
    >
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <SettingsField label="Full name" value={account.full_name} />
        <SettingsField label="Email address" value={account.email} />
      </dl>
    </SettingsSection>
  );
}
