import Link from "next/link";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="qf-admin-root" data-qf-theme="dark">
      <header className="qf-admin-header">
        <div className="qf-admin-header-inner">
          <div>
            <p className="qf-admin-eyebrow">QuoteForge platform</p>
            <h1 className="qf-admin-title">Platform Control Centre</h1>
            <p className="qf-admin-subtitle">
              For Narel and platform owners. Manage businesses, journeys, and
              system setup — not visible to tradespeople.
            </p>
          </div>
          <div className="qf-admin-header-actions">
            <Link href="/dashboard" className="qf-btn-secondary qf-admin-header-link">
              View as trader
            </Link>
          </div>
        </div>
      </header>

      <div className="qf-admin-frame">
        <AdminSidebar />
        <main className="qf-admin-content qf-mobile-safe">{children}</main>
      </div>
    </div>
  );
}
