"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/proposals/new", label: "New Proposal" },
  { href: "/settings", label: "Settings" },
] as const;

function isNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/proposals/new") {
    return pathname === "/proposals/new";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNavLinks() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="flex min-w-0 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden"
    >
      {NAV_LINKS.map((link) => {
        const isActive = isNavLinkActive(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
              isActive
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-white/5 hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
