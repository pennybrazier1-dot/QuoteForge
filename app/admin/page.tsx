import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminShell } from "@/components/admin/admin-shell";
import { assertAdminAccess } from "@/lib/admin/assert-admin-access";
import { PLACEHOLDER_TRADE_SERVICE_REQUESTS } from "@/lib/admin/placeholder-requests";
import { getSupportedPlatformTrades } from "@/lib/admin/platform-trades";

export const metadata: Metadata = {
  title: "Platform Admin — QuoteForge",
  description: "Internal development area for customer enquiry setup.",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  await assertAdminAccess();

  const trades = getSupportedPlatformTrades();
  const serviceLabels = trades.map((trade) => trade.label);

  return (
    <AdminShell>
      <AdminDashboard
        trades={trades}
        serviceLabels={serviceLabels}
        requests={PLACEHOLDER_TRADE_SERVICE_REQUESTS}
      />
    </AdminShell>
  );
}
