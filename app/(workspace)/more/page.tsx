import type { Metadata } from "next";
import Link from "next/link";

const MORE_LINKS = [
  {
    href: "/proposals",
    title: "Proposals",
    subtitle: "All your quotes and proposals",
  },
  {
    href: "/settings",
    title: "Settings",
    subtitle: "Business details and branding",
  },
];

export const metadata: Metadata = {
  title: "More — QuoteForge",
  description: "Proposals, settings, and more.",
};

export default function MorePage() {
  return (
    <div className="qf-page-simple">
      <header className="qf-page-simple-header">
        <h1 className="qf-page-simple-title">More</h1>
        <p className="qf-page-simple-subtitle">Everything else in one place.</p>
      </header>

      <ul className="qf-home-card-list">
        {MORE_LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="qf-home-card qf-touch-target">
              <div className="qf-home-card-body">
                <p className="qf-home-card-title">{link.title}</p>
                <p className="qf-home-card-subtitle">{link.subtitle}</p>
              </div>
              <span className="qf-home-card-chevron" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
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
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
