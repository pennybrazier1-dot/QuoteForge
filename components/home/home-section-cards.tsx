"use client";

import type { HomeSection as HomeSectionData } from "@/lib/home/home-data";
import { HOME_SWIPE_SECTION_IDS } from "@/lib/home/home-data";
import { HomeActionCard } from "@/components/home/home-action-card";
import { HomeSwipeableCard } from "@/components/home/home-swipeable-card";

export function HomeSectionCards({ section }: { section: HomeSectionData }) {
  const enableSwipe = HOME_SWIPE_SECTION_IDS.has(section.id);

  if (section.cards.length === 0) {
    return <div className="qf-home-empty">{section.emptyMessage}</div>;
  }

  return (
    <ul className="qf-home-card-list">
      {section.cards.map((card) => (
        <li key={card.id}>
          {enableSwipe ? (
            <HomeSwipeableCard card={card} sectionTone={section.tone} />
          ) : (
            <HomeActionCard card={card} sectionTone={section.tone} />
          )}
        </li>
      ))}
    </ul>
  );
}
