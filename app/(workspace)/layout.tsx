import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { loadAppShellContext } from "@/lib/layout/load-app-shell";
import "../mobile-home.css";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { fullName, email, recentDrafts } = await loadAppShellContext();

  return (
    <AppShell
      fullName={fullName}
      email={email}
      recentDrafts={recentDrafts}
    >
      {children}
    </AppShell>
  );
}
