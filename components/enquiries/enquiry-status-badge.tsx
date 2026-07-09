import type { EnquiryStatus } from "@/lib/enquiries/types";
import { ENQUIRY_STATUS_LABELS, ENQUIRY_STATUS_TONES } from "@/lib/enquiries/types";

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  const tone = ENQUIRY_STATUS_TONES[status] ?? "muted";
  const label = ENQUIRY_STATUS_LABELS[status] ?? "Unknown";

  return (
    <span className={`qf-enquiry-status qf-enquiry-status-${tone}`}>
      {label}
    </span>
  );
}
