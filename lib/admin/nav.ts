export type AdminNavItem = {
  href: string;
  label: string;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/businesses", label: "Businesses" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/trades", label: "Supported Trades" },
  { href: "/admin/templates", label: "Question Templates" },
  { href: "/admin/service-requests", label: "Service Requests" },
  { href: "/admin/customer-journeys", label: "Customer Journeys" },
  { href: "/admin/support", label: "Support Issues" },
  { href: "/admin/settings", label: "System Settings" },
];

export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getAdminPageTitle(pathname: string): string {
  const item = ADMIN_NAV_ITEMS.find(
    (entry) => entry.href === pathname || pathname.startsWith(`${entry.href}/`)
  );
  return item?.label ?? "Platform Control Centre";
}
