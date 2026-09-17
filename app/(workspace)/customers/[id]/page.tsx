import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerDetailView } from "@/components/customers/customer-detail-view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Customer",
  description: "View a Reanvil customer and their history.",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select(
      "id, name, email, phone, address_line_1, address_line_2, town, county, postcode, notes, created_at, activated_at, archived_at, deletion_requested_at, deletion_scheduled_for, anonymised_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (customerError || !customer) {
    notFound();
  }

  const [{ data: proposalsData }, { data: jobsData }, { data: visitsData }] =
    await Promise.all([
      supabase
        .from("proposals")
        .select(
          "id, proposal_number, title, status, total_amount, created_at, planned_start_date, planned_start_time, booking_confirmation"
        )
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("jobs")
        .select("id, status, accepted_at, completed_at, proposal_id")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("visits")
        .select("id, visit_date, visit_time, status, visit_type")
        .eq("customer_id", id)
        .order("visit_date", { ascending: false }),
    ]);

  const proposalIds = (proposalsData ?? []).map((row) => row.id as string);
  const { data: activityData } =
    proposalIds.length > 0
      ? await supabase
          .from("proposal_status_events")
          .select("id, proposal_id, event_type, to_status, note, created_at")
          .in("proposal_id", proposalIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  return (
    <main className="qf-trader-page qf-customer-detail-page mx-auto w-full max-w-full flex-1 py-10 lg:max-w-3xl">
      <Link
        href="/customers"
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
        Back to Customers
      </Link>

      <div className="mt-6 qf-stack">
        <CustomerDetailView
          customer={customer}
          jobs={(jobsData ?? []).map((job) => {
            const proposal = (proposalsData ?? []).find(
              (item) => item.id === job.proposal_id
            );
            return {
              ...job,
              title: proposal?.title ?? null,
              plannedStartDate: proposal?.planned_start_date ?? null,
              plannedStartTime: proposal?.planned_start_time ?? null,
              bookingConfirmation: proposal?.booking_confirmation ?? null,
            };
          })}
          proposals={proposalsData ?? []}
          visits={visitsData ?? []}
          activity={(activityData ?? []).map((event) => ({
            id: event.id,
            proposalId: event.proposal_id,
            eventType: event.event_type,
            toStatus: event.to_status,
            note: event.note,
            createdAt: event.created_at,
          }))}
        />
        <p className="text-sm text-muted">
          Conversations stay on each proposal. Archive or delete does not remove
          this history.
        </p>
      </div>
    </main>
  );
}
