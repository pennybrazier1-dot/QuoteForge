import type { ReactNode } from "react";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <div className="cj-root">{children}</div>;
}
