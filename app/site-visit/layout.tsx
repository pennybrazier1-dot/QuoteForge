import type { ReactNode } from "react";

export default function SiteVisitLayout({ children }: { children: ReactNode }) {
  return <div className="qf-site-visit-root">{children}</div>;
}
