import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompletedJobsScreen } from "@/components/jobs/completed-jobs-screen";
import { createClient } from "@/lib/supabase/server";
import type { CompletedJobRecord } from "@/lib/jobs/complete-job";

export const metadata: Metadata = {
  title: "Closed Jobs",
  description: "Fully closed jobs kept as history.",
};

export default async function ClosedJobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("proposals")
    .select(
      "id, customer_name, title, job_summary, job_address, completed_at, status, payment_status, closed_at"
    )
    .eq("status", "closed")
    .order("closed_at", { ascending: false });

  return (
    <CompletedJobsScreen
      jobs={(data ?? []) as CompletedJobRecord[]}
      title="Closed Jobs"
      subtitle="Paid and closed work, kept as a permanent record."
      emptyTitle="No closed jobs yet"
      emptyBody="Jobs you close after payment will appear here."
    />
  );
}
