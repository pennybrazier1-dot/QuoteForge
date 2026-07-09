import type { PlatformOverviewStats } from "@/lib/admin/types";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSection } from "@/components/admin/admin-section";

export function OverviewPanel({ stats }: { stats: PlatformOverviewStats }) {
  return (
    <div className="qf-admin-page">
      <AdminPageHeader
        title="Overview"
        description="Platform snapshot — placeholder figures until live analytics are connected."
      />

      <div className="qf-admin-stat-grid">
        <article className="qf-admin-stat-card">
          <p className="qf-admin-stat-label">Active businesses</p>
          <p className="qf-admin-stat-value">{stats.activeBusinesses}</p>
        </article>
        <article className="qf-admin-stat-card">
          <p className="qf-admin-stat-label">New signups this month</p>
          <p className="qf-admin-stat-value">{stats.newSignupsThisMonth}</p>
        </article>
        <article className="qf-admin-stat-card">
          <p className="qf-admin-stat-label">Open issues</p>
          <p className="qf-admin-stat-value">{stats.openIssues}</p>
        </article>
        <article className="qf-admin-stat-card">
          <p className="qf-admin-stat-label">Monthly revenue</p>
          <p className="qf-admin-stat-value">{stats.monthlyRevenueLabel}</p>
          <p className="qf-admin-stat-hint">Placeholder</p>
        </article>
      </div>

      <AdminSection
        title="System health"
        description="Placeholder status until monitoring is wired up."
      >
        <div className="qf-admin-health">
          <span className="qf-admin-pill qf-admin-pill-yes">{stats.systemHealthLabel}</span>
          <p className="qf-admin-health-copy">{stats.systemHealthDetail}</p>
        </div>
      </AdminSection>
    </div>
  );
}
