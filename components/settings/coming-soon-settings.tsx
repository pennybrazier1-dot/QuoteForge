import { SettingsSection } from "@/components/settings/settings-section";

const COMING_SOON_ITEMS = [
  "Edit business details",
  "Subscription and billing",
  "Team members",
  "Branding and logo",
  "Delete account",
] as const;

export function ComingSoonSettings() {
  return (
    <SettingsSection
      title="Coming Soon"
      description="More settings are on the way."
    >
      <ul className="mt-6 space-y-3">
        {COMING_SOON_ITEMS.map((item) => (
          <li
            key={item}
            className="qf-card-inset flex items-center justify-between gap-4"
          >
            <span className="text-sm text-foreground/90">{item}</span>
            <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-muted">
              Soon
            </span>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}
