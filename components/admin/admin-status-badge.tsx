import type { RequestStatus } from "@/lib/admin/types";
import { REQUEST_STATUS_LABELS } from "@/lib/admin/types";

const statusClass: Record<RequestStatus, string> = {
  new: "qf-admin-badge-new",
  reviewing: "qf-admin-badge-reviewing",
  approved: "qf-admin-badge-approved",
  rejected: "qf-admin-badge-rejected",
};

export function AdminStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`qf-admin-badge ${statusClass[status]}`}>
      {REQUEST_STATUS_LABELS[status]}
    </span>
  );
}
