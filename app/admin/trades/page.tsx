import { SupportedTradesPanel } from "@/components/admin/supported-trades-panel";
import { getSupportedPlatformTrades } from "@/lib/admin/platform-trades";

export default function AdminTradesPage() {
  return <SupportedTradesPanel trades={getSupportedPlatformTrades()} />;
}
