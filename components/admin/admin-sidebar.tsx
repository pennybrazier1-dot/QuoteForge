"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS, isAdminNavActive } from "@/lib/admin/nav";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="qf-admin-sidebar" aria-label="Platform admin navigation">
      <p className="qf-admin-sidebar-label">Control centre</p>
      <nav className="qf-admin-sidebar-nav">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = isAdminNavActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`qf-admin-sidebar-link ${
                isActive ? "qf-admin-sidebar-link-active" : ""
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
