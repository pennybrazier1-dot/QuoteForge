import { CustomerJourneysPanel } from "@/components/admin/customer-journeys-panel";
import { PLACEHOLDER_CUSTOMER_JOURNEYS } from "@/lib/admin/placeholder-data";

export default function AdminCustomerJourneysPage() {
  return <CustomerJourneysPanel journeys={PLACEHOLDER_CUSTOMER_JOURNEYS} />;
}
