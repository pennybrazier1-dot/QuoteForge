"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSection } from "@/components/admin/admin-section";
import type { SubscriptionPlan, SubscriptionRecord } from "@/lib/admin/types";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/admin/types";

export function SubscriptionsPanel({
  plans,
  subscriptions,
}: {
  plans: SubscriptionPlan[];
  subscriptions: SubscriptionRecord[];
}) {
  const [notice, setNotice] = useState<string | null>(null);

  function cancelSubscription(subscriptionId: string, businessName: string) {
    setNotice(
      `Cancel subscription placeholder for ${businessName} (${subscriptionId}) — not saved yet.`
    );
  }

  return (
    <div className="qf-admin-page">
      <AdminPageHeader
        title="Subscriptions"
        description="Plans and billing status — placeholders until Stripe is connected."
      />

      {notice ? (
        <p className="qf-admin-inline-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="qf-admin-stat-grid">
        {plans.map((plan) => (
          <article key={plan.id} className="qf-admin-stat-card">
            <p className="qf-admin-stat-label">{plan.name}</p>
            <p className="qf-admin-stat-value">{plan.priceLabel}</p>
            <p className="qf-admin-stat-hint">
              {plan.activeCount} active · {plan.trialCount} trial ·{" "}
              {plan.cancelledCount} cancelled
            </p>
          </article>
        ))}
      </div>

      <AdminSection title="Subscription records">
        <div className="qf-admin-table-wrap">
          <table className="qf-admin-table">
            <thead>
              <tr>
                <th scope="col">Business</th>
                <th scope="col">Plan</th>
                <th scope="col">Status</th>
                <th scope="col">Payment</th>
                <th scope="col">Renews</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="qf-admin-table-strong">
                    {subscription.businessName}
                  </td>
                  <td>{subscription.planName}</td>
                  <td>{SUBSCRIPTION_STATUS_LABELS[subscription.status]}</td>
                  <td className="qf-admin-capitalize">
                    {subscription.paymentStatus}
                  </td>
                  <td>{subscription.renewsOn}</td>
                  <td>
                    <button
                      type="button"
                      className="qf-admin-action-btn"
                      onClick={() =>
                        cancelSubscription(
                          subscription.id,
                          subscription.businessName
                        )
                      }
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </div>
  );
}
