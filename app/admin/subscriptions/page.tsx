import { SubscriptionsPanel } from "@/components/admin/subscriptions-panel";
import {
  PLACEHOLDER_SUBSCRIPTION_PLANS,
  PLACEHOLDER_SUBSCRIPTIONS,
} from "@/lib/admin/placeholder-data";

export default function AdminSubscriptionsPage() {
  return (
    <SubscriptionsPanel
      plans={PLACEHOLDER_SUBSCRIPTION_PLANS}
      subscriptions={PLACEHOLDER_SUBSCRIPTIONS}
    />
  );
}
