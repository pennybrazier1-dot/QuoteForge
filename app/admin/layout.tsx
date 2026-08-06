import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { assertAdminAccess } from "@/lib/admin/assert-admin-access";

export const metadata: Metadata = {
  title: "Platform Control Centre",
  description: "Internal platform administration for Reanvil owners.",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await assertAdminAccess();

  return <AdminShell>{children}</AdminShell>;
}
