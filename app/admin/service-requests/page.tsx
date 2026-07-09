import { TradeServiceRequestsPanel } from "@/components/admin/trade-service-requests-panel";
import { PLACEHOLDER_TRADE_SERVICE_REQUESTS } from "@/lib/admin/placeholder-data";

export default function AdminServiceRequestsPage() {
  return (
    <TradeServiceRequestsPanel
      initialRequests={PLACEHOLDER_TRADE_SERVICE_REQUESTS}
    />
  );
}
