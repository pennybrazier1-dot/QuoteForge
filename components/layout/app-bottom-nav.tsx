"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV_ITEMS, isAppNavActive } from "@/lib/layout/app-nav";

const BOTTOM_NAV_ICONS: Record<string, ReactNode> = {
  "/dashboard": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  "/customers": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  "/proposals/new": (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  "/calendar": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  ),
  "/more": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  ),
};

export function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="qf-bottom-nav" aria-label="Main navigation">
      <div className="qf-bottom-nav-inner">
        {APP_NAV_ITEMS.map((item) => {
          const isActive = isAppNavActive(pathname, item.href);
          const isPrimary = item.primary === true;

          if (isPrimary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="qf-bottom-nav-primary qf-touch-target"
                aria-label="New quote"
              >
                <span className="qf-bottom-nav-primary-icon">
                  {BOTTOM_NAV_ICONS[item.href]}
                </span>
                <span className="qf-bottom-nav-primary-label">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`qf-bottom-nav-link qf-touch-target ${
                isActive
                  ? item.href === "/dashboard"
                    ? "qf-bottom-nav-link-active-home"
                    : "qf-bottom-nav-link-active"
                  : ""
              }`}
            >
              <span className="qf-bottom-nav-link-icon">
                {BOTTOM_NAV_ICONS[item.href]}
              </span>
              <span className="qf-bottom-nav-link-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
