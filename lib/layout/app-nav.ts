export type AppNavItem = {
  href: string;
  label: string;
  /** Bottom nav only — centre primary action */
  primary?: boolean;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/customers", label: "Customers" },
  { href: "/proposals/new", label: "New", primary: true },
  { href: "/calendar", label: "Calendar" },
  { href: "/more", label: "More" },
];

/** Desktop sidebar — includes proposals list and settings */
export const DESKTOP_SIDEBAR_ITEMS: AppNavItem[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/customers", label: "Customers" },
  { href: "/proposals/new", label: "New Proposal" },
  { href: "/proposals", label: "Proposals" },
  { href: "/calendar", label: "Calendar" },
  { href: "/settings", label: "Settings" },
];

export const ADMIN_SIDEBAR_ITEM: AppNavItem = {
  href: "/admin",
  label: "Admin",
};

export function isAppNavActive(pathname: string, href: string): boolean {
  if (href === "/proposals/new") {
    return pathname === "/proposals/new";
  }

  if (href === "/proposals") {
    return (
      pathname === "/proposals" ||
      (pathname.startsWith("/proposals/") && pathname !== "/proposals/new")
    );
  }

  if (href === "/more") {
    return pathname === "/more" || pathname.startsWith("/settings");
  }

  if (href === "/calendar") {
    return pathname === "/calendar" || pathname.startsWith("/calendar/");
  }

  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }

  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
