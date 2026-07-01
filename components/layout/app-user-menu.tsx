"use client";

import { logout } from "@/app/auth/actions";
import { LogoutButton } from "@/components/auth/logout-button";

function getInitials(fullName: string | null, email: string | null): string {
  const name = fullName?.trim();

  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
    }

    return parts[0]!.slice(0, 2).toUpperCase();
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "QF";
}

export function AppUserMenu({
  fullName,
  email,
}: {
  fullName: string | null;
  email: string | null;
}) {
  const displayName = fullName?.trim() || "Your account";

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-white/5 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
        >
          {getInitials(fullName, email)}
        </span>
        <span className="hidden min-w-0 text-left lg:block">
          <span className="block truncate text-sm font-medium leading-tight">
            {displayName}
          </span>
          {email ? (
            <span className="block truncate text-xs text-muted">{email}</span>
          ) : null}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hidden shrink-0 text-muted transition-transform group-open:rotate-180 lg:block"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[12rem] rounded-xl border border-border-card bg-background-elevated p-2 shadow-lg">
        <form action={logout}>
          <LogoutButton />
        </form>
      </div>
    </details>
  );
}
