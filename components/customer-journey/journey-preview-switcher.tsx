"use client";

import {
  JOURNEY_PREVIEW_PROFILES,
  type JourneyPreviewProfileId,
} from "@/lib/customer-journey/constants";
import { useJourney } from "@/lib/customer-journey/journey-provider";

const PROFILE_ORDER: JourneyPreviewProfileId[] = [
  "single-trade",
  "multi-trade",
  "handyman",
];

export function JourneyPreviewSwitcher() {
  const { activePreviewProfileId, switchPreviewProfile } = useJourney();

  return (
    <div
      className="cj-dev-preview"
      role="region"
      aria-label="Development preview switcher"
    >
      <p className="cj-dev-preview-label">Dev preview</p>
      <div className="cj-dev-preview-options" role="tablist" aria-label="Business type">
        {PROFILE_ORDER.map((profileId) => {
          const profile = JOURNEY_PREVIEW_PROFILES[profileId];
          const isActive = activePreviewProfileId === profileId;

          return (
            <button
              key={profileId}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={[
                "cj-dev-preview-option",
                isActive ? "cj-dev-preview-option-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => switchPreviewProfile(profileId)}
            >
              {profile.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
