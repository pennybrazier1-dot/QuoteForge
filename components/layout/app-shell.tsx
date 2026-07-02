import type { ReactNode } from "react";
import {
  AppSidebar,
  type SidebarDraftItem,
} from "@/components/layout/app-sidebar";
import { AppBottomNav } from "@/components/layout/app-bottom-nav";
import { AppTopNav } from "@/components/layout/app-top-nav";
import {
  WorkspaceScrollEnd,
  WorkspaceScrollSync,
} from "@/components/layout/workspace-scroll-end";

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
    <div className="qf-app" data-qf-theme="dark">
      <AppTopNav fullName={fullName} email={email} />

      <div className="qf-app-frame">
        <AppSidebar recentDrafts={recentDrafts} />
        <main className="qf-app-main qf-workspace-scroll qf-mobile-safe">
          {children}
          <WorkspaceScrollEnd />
        </main>
      </div>

      <WorkspaceScrollSync />
      <AppBottomNav />
    </div>
  );
}
