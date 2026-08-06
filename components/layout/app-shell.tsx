import type { ReactNode } from "react";
import {
  AppSidebar,
  type SidebarDraftItem,
} from "@/components/layout/app-sidebar";
import { AppBottomNav } from "@/components/layout/app-bottom-nav";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { AdminTraderViewBanner } from "@/components/layout/admin-trader-view-banner";
import {
  WorkspaceScrollEnd,
  WorkspaceScrollSync,
} from "@/components/layout/workspace-scroll-end";

export function AppShell({
  fullName,
  email,
  recentDrafts,
  adminNavEnabled = false,
  viewingTraderAsAdmin = false,
  children,
}: {
  fullName: string | null;
  email: string | null;
  recentDrafts: SidebarDraftItem[];
  adminNavEnabled?: boolean;
  viewingTraderAsAdmin?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="qf-app" data-qf-theme="dark">
      {viewingTraderAsAdmin ? <AdminTraderViewBanner /> : null}
      <AppTopNav fullName={fullName} email={email} />

      <div className="qf-app-frame">
        <AppSidebar recentDrafts={recentDrafts} adminNavEnabled={adminNavEnabled} />
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
