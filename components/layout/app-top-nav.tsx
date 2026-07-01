"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppUserMenu } from "@/components/layout/app-user-menu";
import { APP_NAV_ITEMS, isAppNavActive } from "@/lib/layout/app-nav";

export function AppTopNav({
  fullName,
  email,
}: {
  fullName: string | null;
  email: string | null;
}) {
  const pathname = usePathname();

  return (
    <header className="qf-app-top">
      <div className="qf-app-top-inner">
        <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-8">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-black">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
            </span>
            <span className="text-lg font-semibold tracking-tight">QuoteForge</span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden min-w-0 items-center gap-0.5 md:flex"
          >
            {APP_NAV_ITEMS.map((item) => {
              const isActive = isAppNavActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`qf-top-nav-link shrink-0 px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? "qf-top-nav-link-active" : ""
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Notifications"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </button>

          <AppUserMenu fullName={fullName} email={email} />
        </div>
      </div>
    </header>
  );
}
