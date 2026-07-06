import Link from "next/link";
import type { ReactNode } from "react";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="qf-admin-root" data-qf-theme="dark">
      <header className="qf-admin-header">
        <div className="qf-admin-header-inner">
          <div>
            <p className="qf-admin-eyebrow">QuoteForge internal</p>
            <h1 className="qf-admin-title">Platform Admin</h1>
            <p className="qf-admin-subtitle">
              Manage customer enquiry setup during development. Not visible to
              tradespeople.
            </p>
          </div>
          <div className="qf-admin-header-actions">
            <Link href="/dashboard" className="qf-btn-secondary qf-admin-header-link">
              View as trader
            </Link>
          </div>
        </div>
      </header>

      <main className="qf-admin-main qf-mobile-safe">{children}</main>
    </div>
  );
}
