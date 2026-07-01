import type { ReactNode } from "react";
import {
  AppSidebar,
  type SidebarDraftItem,
} from "@/components/layout/app-sidebar";
import { AppTopNav } from "@/components/layout/app-top-nav";

export function AppShell({
  fullName,
  email,
  recentDrafts,
  children,
}: {
  fullName: string | null;
  email: string | null;
  recentDrafts: SidebarDraftItem[];
  children: ReactNode;
}) {
  return (
    <div className="qf-app">
      <AppTopNav fullName={fullName} email={email} />

      <div className="qf-app-frame">
        <AppSidebar recentDrafts={recentDrafts} />
        <main className="qf-app-main">{children}</main>
      </div>
    </div>
  );
}
