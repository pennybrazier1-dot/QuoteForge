import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { LogoutButton } from "@/components/auth/logout-button";

export function DashboardTopBar({ email }: { email?: string | null }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
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

        <div className="flex items-center gap-4">
          {email ? (
            <span className="hidden text-sm text-muted sm:block">{email}</span>
          ) : null}
          <form action={logout}>
            <LogoutButton />
          </form>
        </div>
      </div>
    </header>
  );
}
