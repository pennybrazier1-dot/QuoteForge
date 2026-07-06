"use client";

import { useState } from "react";
import { AdminSection } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { RequestStatus, TradeServiceRequest } from "@/lib/admin/types";
import { REQUEST_STATUS_LABELS } from "@/lib/admin/types";

const STATUS_OPTIONS: RequestStatus[] = [
  "new",
  "reviewing",
  "approved",
  "rejected",
];

export function TradeServiceRequestsPanel({
  initialRequests,
}: {
  initialRequests: TradeServiceRequest[];
}) {
  const [requests, setRequests] = useState(initialRequests);

  function updateStatus(id: string, status: RequestStatus) {
    setRequests((current) =>
      current.map((request) =>
        request.id === id ? { ...request, status } : request
      )
    );
  }

  return (
    <AdminSection
      title="Trade / Service Requests"
      description="Placeholder requests from tradespeople for unsupported trades or services."
    >
      <div className="qf-admin-table-wrap">
        <table className="qf-admin-table">
          <thead>
            <tr>
              <th scope="col">Requested name</th>
              <th scope="col">Description</th>
              <th scope="col">Reason</th>
              <th scope="col">Requested by</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td className="qf-admin-table-strong">{request.requestedName}</td>
                <td>{request.description}</td>
                <td>{request.reason}</td>
                <td>{request.requestedBy}</td>
                <td>
                  <div className="qf-admin-request-status">
                    <AdminStatusBadge status={request.status} />
                    <select
                      className="form-select qf-admin-status-select"
                      value={request.status}
                      aria-label={`Status for ${request.requestedName}`}
                      onChange={(event) =>
                        updateStatus(request.id, event.target.value as RequestStatus)
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {REQUEST_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="qf-admin-local-note">
        Placeholder data only — status changes are not saved yet.
      </p>
    </AdminSection>
  );
}
