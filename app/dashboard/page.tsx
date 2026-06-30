import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { DashboardTopBar } from "@/components/dashboard/top-bar";
import { QuoteComposer } from "@/components/dashboard/quote-composer";
import { TodaysAdmin } from "@/components/dashboard/todays-admin";
import { RecentProposals } from "@/components/dashboard/recent-proposals";

export const metadata: Metadata = {
  title: "Dashboard — QuoteForge",
  description: "Your QuoteForge dashboard.",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await userHasProfile(user.id))) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <DashboardTopBar email={user.email} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Let&apos;s get today&apos;s paperwork finished.
        </h1>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <QuoteComposer />
          </div>
          <div className="lg:col-span-1">
            <TodaysAdmin />
          </div>
        </div>

        <div className="mt-6">
          <RecentProposals />
        </div>
      </main>
    </div>
  );
}
