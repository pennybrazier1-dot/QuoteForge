import type { EnquiryStatus } from "@/lib/enquiries/types";
import { ENQUIRY_STATUS_LABELS, ENQUIRY_STATUS_TONES } from "@/lib/enquiries/types";

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  return (
    <span className={`qf-enquiry-status qf-enquiry-status-${ENQUIRY_STATUS_TONES[status]}`}>
      {ENQUIRY_STATUS_LABELS[status]}
    </span>
  );
}
