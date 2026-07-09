"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSection } from "@/components/admin/admin-section";
import type { PlatformBusiness } from "@/lib/admin/types";
import {
  BUSINESS_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from "@/lib/admin/types";

export function BusinessesPanel({
  initialBusinesses,
}: {
  initialBusinesses: PlatformBusiness[];
}) {
  const [notice, setNotice] = useState<string | null>(null);

  function runPlaceholderAction(businessId: string, action: string) {
    setNotice(`${action} recorded locally for ${businessId} — not saved yet.`);
  }

  return (
    <div className="qf-admin-page">
      <AdminPageHeader
        title="Businesses"
        description="Tradesperson businesses on the platform — placeholder data only."
      />

      {notice ? (
        <p className="qf-admin-inline-notice" role="status">
          {notice}
        </p>
      ) : null}

      <AdminSection title="All businesses">
        <div className="qf-admin-table-wrap">
          <table className="qf-admin-table">
            <thead>
              <tr>
                <th scope="col">Business</th>
                <th scope="col">Status</th>
                <th scope="col">Subscription</th>
                <th scope="col">Trade</th>
                <th scope="col">Enquiries</th>
                <th scope="col">Jobs</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialBusinesses.map((business) => (
                <tr key={business.id}>
                  <td>
                    <p className="qf-admin-table-strong">{business.name}</p>
                    <p className="qf-admin-table-sub">{business.ownerEmail}</p>
                  </td>
                  <td>{BUSINESS_STATUS_LABELS[business.status]}</td>
                  <td>{SUBSCRIPTION_STATUS_LABELS[business.subscriptionStatus]}</td>
                  <td>{business.tradeType}</td>
                  <td>{business.enquiryCount}</td>
                  <td>{business.jobCount}</td>
                  <td>
                    <div className="qf-admin-actions">
                      <button
                        type="button"
                        className="qf-admin-action-btn"
                        onClick={() => runPlaceholderAction(business.id, "View")}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="qf-admin-action-btn"
                        onClick={() =>
                          runPlaceholderAction(business.id, "Suspend")
                        }
                      >
                        Suspend
                      </button>
                      <button
                        type="button"
                        className="qf-admin-action-btn"
                        onClick={() =>
                          runPlaceholderAction(business.id, "Cancel subscription")
                        }
                      >
                        Cancel sub
                      </button>
                    </div>
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
