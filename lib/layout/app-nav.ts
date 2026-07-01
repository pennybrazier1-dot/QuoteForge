export type AppNavItem = {
  href: string;
  label: string;
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/proposals/new", label: "New Proposal" },
  { href: "/proposals", label: "Proposals" },
  { href: "/settings", label: "Settings" },
];

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

  return pathname === href || pathname.startsWith(`${href}/`);
}
