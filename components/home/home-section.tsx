import Link from "next/link";
import type { HomeSection as HomeSectionData } from "@/lib/home/home-data";
import { HomeActionCard } from "@/components/home/home-action-card";

function SectionIcon({ sectionId }: { sectionId: string }) {
  if (sectionId === "todays-jobs") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    );
  }

  if (sectionId === "jobs-needing-attention") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="8" y2="12" />
        <line x1="12" x2="12.01" y1="16" y2="16" />
      </svg>
    );
  }

  if (sectionId === "new-quote-requests") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export function HomeSection({ section }: { section: HomeSectionData }) {
  return (
    <section
      className={`qf-home-section qf-home-section-${section.tone}`}
      aria-labelledby={`home-section-${section.id}`}
    >
      <div className="qf-home-section-head">
        <div className="qf-home-section-title-row">
          <span className="qf-home-section-icon" aria-hidden="true">
            <SectionIcon sectionId={section.id} />
          </span>
          <h2 id={`home-section-${section.id}`} className="qf-home-section-title">
            {section.title}
          </h2>
        </div>

        {section.cards.length > 0 ? (
          <Link href={section.viewAllHref} className="qf-home-section-view-all">
            View all
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        ) : null}
      </div>

      {section.cards.length === 0 ? (
        <div className="qf-home-empty">{section.emptyMessage}</div>
      ) : (
        <ul className="qf-home-card-list">
          {section.cards.map((card) => (
            <li key={card.id}>
              <HomeActionCard card={card} sectionTone={section.tone} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
