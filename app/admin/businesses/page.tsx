import { BusinessesPanel } from "@/components/admin/businesses-panel";
import { PLACEHOLDER_BUSINESSES } from "@/lib/admin/placeholder-data";

export default function AdminBusinessesPage() {
  return <BusinessesPanel initialBusinesses={PLACEHOLDER_BUSINESSES} />;
}
