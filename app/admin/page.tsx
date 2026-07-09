import { OverviewPanel } from "@/components/admin/overview-panel";
import { PLACEHOLDER_OVERVIEW_STATS } from "@/lib/admin/placeholder-data";

export default function AdminOverviewPage() {
  return <OverviewPanel stats={PLACEHOLDER_OVERVIEW_STATS} />;
}
