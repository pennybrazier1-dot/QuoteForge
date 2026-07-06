import type { ReactNode } from "react";

export default function RequestQuoteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="cj-root">{children}</div>;
}
