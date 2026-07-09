import { ServiceTemplatesPanel } from "@/components/admin/service-templates-panel";
import { getSupportedPlatformTrades } from "@/lib/admin/platform-trades";

export default function AdminTemplatesPage() {
  const serviceLabels = getSupportedPlatformTrades().map((trade) => trade.label);

  return <ServiceTemplatesPanel serviceLabels={serviceLabels} />;
}
