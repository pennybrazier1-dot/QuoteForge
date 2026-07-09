import { SupportIssuesPanel } from "@/components/admin/support-issues-panel";
import { PLACEHOLDER_SUPPORT_ISSUES } from "@/lib/admin/placeholder-data";

export default function AdminSupportPage() {
  return <SupportIssuesPanel initialIssues={PLACEHOLDER_SUPPORT_ISSUES} />;
}
