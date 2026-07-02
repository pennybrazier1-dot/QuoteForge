import type { HomeCard, HomeSectionTone } from "@/lib/home/home-data";

function JobTypeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export function HomeCardContent({
  card,
}: {
  card: HomeCard;
  sectionTone?: HomeSectionTone;
}) {
  return (
    <>
      <div className="qf-home-card-top">
        <div className="qf-home-card-leading">
          <span className="qf-home-card-avatar" aria-hidden="true">
            <JobTypeIcon />
          </span>

          <div className="qf-home-card-body">
            <p className="qf-home-card-title">{card.customer}</p>
            <p className="qf-home-card-subtitle">{card.jobTitle}</p>
          </div>
        </div>

        <div className="qf-home-card-trail">
          <span className={`qf-home-status qf-home-status-${card.status.tone}`}>
            {card.status.label}
          </span>
          <span className="qf-home-card-chevron" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </span>
        </div>
      </div>

      {card.timeLabel || card.addressLine ? (
        <div className="qf-home-card-meta-row">
          {card.timeLabel ? (
            <span className="qf-home-card-meta-item">
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
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {card.timeLabel}
            </span>
          ) : null}

          {card.addressLine ? (
            <span className="qf-home-card-meta-item">
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
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="qf-home-card-meta-text">{card.addressLine}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {card.attentionNote ? (
        <p className="qf-home-card-attention">
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
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {card.attentionNote}
        </p>
      ) : null}
    </>
  );
}

export function homeCardClassName(sectionTone: HomeSectionTone): string {
  return `qf-home-card qf-home-card-${sectionTone} qf-touch-target`;
}
