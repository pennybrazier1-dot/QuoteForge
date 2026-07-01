import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardTopBar } from "@/components/dashboard/top-bar";
import { ProposalStudioForm } from "@/components/proposals/proposal-studio-form";
import { userHasProfile } from "@/lib/onboarding/status";
import { parseEstimatedDuration } from "@/lib/proposals/duration";
import type { ProposalFormValues } from "@/lib/proposals/form-values";
import { formatPenceForInput } from "@/lib/proposals/money";
import { formatOptionalExtrasForForm } from "@/lib/proposals/optional-extras";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit Draft Proposal — QuoteForge",
  description: "Edit your draft QuoteForge proposal.",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProposalPage({ params }: PageProps) {
  const { id } = await params;
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

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select(
      "id, status, customer_name, customer_email, customer_phone, customer_address, job_address, rough_notes, optional_extras, things_to_confirm, total_amount"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !proposal) {
    notFound();
  }

  if (proposal.status !== "draft") {
    redirect(`/proposals/${id}`);
  }

  const initialValues: ProposalFormValues = {
    customerName: proposal.customer_name ?? "",
    propertyAddress:
      proposal.customer_address ?? proposal.job_address ?? "",
    phoneNumber: proposal.customer_phone ?? "",
    emailAddress: proposal.customer_email ?? "",
    jobDescription: proposal.rough_notes ?? "",
    optionalExtras: formatOptionalExtrasForForm(proposal.optional_extras),
    estimatedPrice: formatPenceForInput(proposal.total_amount),
    estimatedDuration: parseEstimatedDuration(proposal.things_to_confirm),
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <DashboardTopBar email={user.email} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <Link
          href={`/proposals/${id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Proposal
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
          Edit Draft Proposal
        </h1>
        <p className="mt-2 text-sm text-muted">
          Update the customer details, site notes, or estimate. Your changes
          are saved when you tap Save Draft.
        </p>

        <div className="mt-8">
          <ProposalStudioForm
            mode="edit"
            proposalId={id}
            initialValues={initialValues}
          />
        </div>
      </main>
    </div>
  );
}
