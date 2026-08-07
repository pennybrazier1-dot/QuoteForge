"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import {
  isJobPrepItemStatus,
  isPrepItemResolved,
} from "@/lib/jobs/prep-items";
import { needsJobPreparation } from "@/lib/jobs/status";

export type JobPrepActionState = {
  error?: string;
  ok?: boolean;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function revalidateJobViews(proposalId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath("/calendar");
}

export async function updateJobPrepItemStatus(
  _prev: JobPrepActionState,
  formData: FormData
): Promise<JobPrepActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!(await userHasProfile(user.id))) {
    return { error: "Please complete onboarding first." };
  }

  const prepItemId = getString(formData, "prepItemId");
  const proposalId = getString(formData, "proposalId");
  const nextStatus = getString(formData, "status");

  if (!prepItemId || !proposalId) {
    return { error: "Preparation item not found." };
  }

  if (!isJobPrepItemStatus(nextStatus) || nextStatus === "open") {
    return { error: "Choose Confirmed or Not needed." };
  }

  const { data: item, error: loadError } = await supabase
    .from("job_prep_items")
    .select("id, job_id")
    .eq("id", prepItemId)
    .maybeSingle();

  if (loadError || !item) {
    return { error: "Preparation item not found." };
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, proposal_id, status")
    .eq("id", item.job_id)
    .maybeSingle();

  if (jobError || !job || job.proposal_id !== proposalId) {
    return { error: "Preparation item not found." };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("job_prep_items")
    .update({
      status: nextStatus,
      confirmed_at: isPrepItemResolved(nextStatus) ? now : null,
    })
    .eq("id", prepItemId);

  if (updateError) {
    return { error: updateError.message || "Could not update this item." };
  }

  if (needsJobPreparation(job.status)) {
    await supabase
      .from("jobs")
      .update({ status: "preparing" })
      .eq("id", job.id)
      .in("status", ["accepted", "preparing"]);
  }

  // When start date is confirmed, move the job toward scheduled.
  if (nextStatus === "confirmed") {
    const { data: prepItem } = await supabase
      .from("job_prep_items")
      .select("item_key")
      .eq("id", prepItemId)
      .maybeSingle();

    if (prepItem?.item_key === "start_date") {
      await supabase
        .from("jobs")
        .update({ status: "scheduled" })
        .eq("id", job.id)
        .in("status", ["accepted", "preparing", "scheduled"]);
    }
  }

  await revalidateJobViews(proposalId);
  return { ok: true };
}
