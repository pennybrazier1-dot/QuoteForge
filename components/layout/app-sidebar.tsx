"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  formatProposalStatus,
  getStatusBadgeClass,
} from "@/lib/proposals/status";
import { DESKTOP_SIDEBAR_ITEMS, isAppNavActive } from "@/lib/layout/app-nav";

export type SidebarDraftItem = {
  id: string;
  customer_name: string | null;
  subtitle: string;
  status: string;
};

const NAV_ICONS: Record<string, ReactNode> = {
  "/dashboard": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  "/customers": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  "/proposals/new": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  "/proposals": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  ),
  "/calendar": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  ),
  "/settings": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};

export function AppSidebar({ recentDrafts }: { recentDrafts: SidebarDraftItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="qf-app-sidebar" aria-label="Sidebar">
      <div className="qf-app-sidebar-inner">
        <p className="qf-sidebar-label">Main</p>
        <nav aria-label="Sidebar navigation" className="qf-sidebar-nav">
          {DESKTOP_SIDEBAR_ITEMS.map((item) => {
            const isActive = isAppNavActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`qf-sidebar-link ${isActive ? "qf-sidebar-link-active" : ""}`}
              >
                <span className="qf-sidebar-link-icon text-accent">
                  {NAV_ICONS[item.href]}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="qf-sidebar-divider" />

        <p className="qf-sidebar-label">Recent drafts</p>
        {recentDrafts.length === 0 ? (
          <p className="px-2 text-xs leading-relaxed text-muted">
            No draft proposals yet.
          </p>
        ) : (
          <ul className="qf-sidebar-drafts">
            {recentDrafts.map((draft) => (
              <li key={draft.id}>
                <Link href={`/proposals/${draft.id}/edit`} className="qf-sidebar-draft">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {draft.customer_name ?? "Unknown customer"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {draft.subtitle}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${getStatusBadgeClass(draft.status)}`}
                  >
                    {formatProposalStatus(draft.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="qf-sidebar-divider" />

        <div className="qf-sidebar-help">
          <div className="flex items-start gap-2.5">
            <span className="qf-sidebar-help-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold">Need help?</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                Visit our help centre or contact support.
              </p>
            </div>
          </div>
          <button type="button" className="qf-sidebar-help-button">
            Help Centre
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
              <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
