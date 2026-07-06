import Link from "next/link";
import { AdminSection } from "@/components/admin/admin-section";

const PREVIEW_LINKS = [
  {
    href: "/request-quote",
    title: "Default enquiry",
    description: "Single-trade preview (Smith Plumbing).",
  },
  {
    href: "/request-quote/multi",
    title: "Multi-trade enquiry",
    description: "Service picker with multiple trades.",
  },
  {
    href: "/request-quote/handyman",
    title: "Handyman enquiry",
    description: "Custom handyman service list.",
  },
] as const;

export function CustomerEnquiryPreviewPanel() {
  return (
    <AdminSection
      title="Customer Enquiry Preview"
      description="Open the public customer journey in a new tab to test the flow."
    >
      <ul className="qf-admin-link-list">
        {PREVIEW_LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="qf-admin-link-card" target="_blank">
              <span className="qf-admin-link-card-title">{link.title}</span>
              <span className="qf-admin-link-card-copy">{link.description}</span>
              <span className="qf-admin-link-card-url">{link.href}</span>
            </Link>
          </li>
        ))}
      </ul>
    </AdminSection>
  );
}

export function ViewAsTraderPanel() {
  return (
    <AdminSection
      title="View as Trader"
      description="Return to the tradesperson workspace to use the app normally."
    >
      <Link href="/dashboard" className="qf-admin-trader-link qf-btn-primary">
        Open trader dashboard
      </Link>
    </AdminSection>
  );
}
