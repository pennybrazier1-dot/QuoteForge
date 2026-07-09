"use client";

import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSection } from "@/components/admin/admin-section";
import type { SupportIssue, SupportIssuePriority, SupportIssueStatus } from "@/lib/admin/types";
import {
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
} from "@/lib/admin/types";

const STATUS_OPTIONS: SupportIssueStatus[] = ["open", "in_progress", "resolved"];
const PRIORITY_OPTIONS: SupportIssuePriority[] = ["low", "medium", "high"];

export function SupportIssuesPanel({
  initialIssues,
}: {
  initialIssues: SupportIssue[];
}) {
  const [issues, setIssues] = useState(initialIssues);

  function updateStatus(id: string, status: SupportIssueStatus) {
    setIssues((current) =>
      current.map((issue) => (issue.id === id ? { ...issue, status } : issue))
    );
  }

  function updatePriority(id: string, priority: SupportIssuePriority) {
    setIssues((current) =>
      current.map((issue) => (issue.id === id ? { ...issue, priority } : issue))
    );
  }

  return (
    <div className="qf-admin-page">
      <AdminPageHeader
        title="Support Issues"
        description="Customer and tradesperson support problems — placeholder queue."
      />

      <AdminSection title="Open issues">
        <div className="qf-admin-table-wrap">
          <table className="qf-admin-table">
            <thead>
              <tr>
                <th scope="col">Subject</th>
                <th scope="col">Reported by</th>
                <th scope="col">Business</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
                <th scope="col">Assigned to</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id}>
                  <td className="qf-admin-table-strong">{issue.subject}</td>
                  <td>{issue.reportedBy}</td>
                  <td>{issue.businessName}</td>
                  <td>
                    <select
                      className="form-select qf-admin-status-select"
                      value={issue.status}
                      aria-label={`Status for ${issue.subject}`}
                      onChange={(event) =>
                        updateStatus(
                          issue.id,
                          event.target.value as SupportIssueStatus
                        )
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {SUPPORT_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select qf-admin-status-select"
                      value={issue.priority}
                      aria-label={`Priority for ${issue.subject}`}
                      onChange={(event) =>
                        updatePriority(
                          issue.id,
                          event.target.value as SupportIssuePriority
                        )
                      }
                    >
                      {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>
                          {SUPPORT_PRIORITY_LABELS[priority]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{issue.assignedTo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="qf-admin-local-note">Changes are local only — not saved yet.</p>
      </AdminSection>
    </div>
  );
}
