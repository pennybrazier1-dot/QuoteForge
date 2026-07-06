import type { SupportedPlatformTrade, TradeServiceRequest } from "@/lib/admin/types";
import { CustomerEnquiryPreviewPanel, ViewAsTraderPanel } from "@/components/admin/admin-quick-links";
import { ServiceTemplatesPanel } from "@/components/admin/service-templates-panel";
import { SupportedTradesPanel } from "@/components/admin/supported-trades-panel";
import { TradeServiceRequestsPanel } from "@/components/admin/trade-service-requests-panel";

type AdminDashboardProps = {
  trades: SupportedPlatformTrade[];
  serviceLabels: string[];
  requests: TradeServiceRequest[];
};

export function AdminDashboard({
  trades,
  serviceLabels,
  requests,
}: AdminDashboardProps) {
  return (
    <div className="qf-admin-dashboard">
      <div className="qf-admin-dashboard-top">
        <ViewAsTraderPanel />
        <CustomerEnquiryPreviewPanel />
      </div>

      <SupportedTradesPanel trades={trades} />
      <ServiceTemplatesPanel serviceLabels={serviceLabels} />
      <TradeServiceRequestsPanel initialRequests={requests} />
    </div>
  );
}
