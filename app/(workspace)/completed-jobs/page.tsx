import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompletedJobsScreen } from "@/components/jobs/completed-jobs-screen";
import { createClient } from "@/lib/supabase/server";
import {
  COMPLETED_JOB_LIST_STATUSES,
  type CompletedJobRecord,
} from "@/lib/jobs/complete-job";

export const metadata: Metadata = {
  title: "Completed Jobs",
  description: "Historical record of finished work.",
};

export default async function CompletedJobsPage() {
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
    .in("status", [...COMPLETED_JOB_LIST_STATUSES])
    .is("closed_at", null)
    .order("completed_at", { ascending: false });

  return <CompletedJobsScreen jobs={(data ?? []) as CompletedJobRecord[]} />;
}
