import Link from "next/link";

/** Shown when a PLATFORM_ADMIN_EMAILS user is using the trader app shell. */
export function AdminTraderViewBanner() {
  return (
    <div className="qf-admin-trader-banner" role="status">
      <p className="qf-admin-trader-banner-text">Viewing trader app</p>
      <Link href="/admin" className="qf-admin-trader-banner-link">
        Back to Platform Control Centre
      </Link>
    </div>
  );
}
