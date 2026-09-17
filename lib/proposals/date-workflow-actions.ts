"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasProfile } from "@/lib/onboarding/status";
import { loadProposalCustomerMessages } from "@/lib/proposals/customer-portal/messages";
import {
  applyTraderConfirmDate,
  applyTraderProvisionalHold,
  buildDateWorkflowSnapshot,
  nextStatusAfterDateResolved,
  sameDateSlot,
} from "@/lib/proposals/date-workflow";
import {
  hasOtherUnresolvedWorkRequests,
  notifyCustomerProposedDate,
  persistProposalDateSlot,
  promoteBookedJobIfReady,
  type DateWorkflowProposalRow,
} from "@/lib/proposals/date-workflow-persist";
import { formatSlotLabel } from "@/lib/proposals/revision/conversation-agreements";
import {
  buildScheduleDateLabel,
  normalizePlannedStartTime,
} from "@/lib/proposals/schedule/schedule-fields";
import { normalizeProposalStatus } from "@/lib/proposals/status";

export type DateWorkflowActionState = {
  error?: string;
  ok?: boolean;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateDatePaths(proposalId: string, portalToken?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/proposals");
  revalidatePath(`/proposals/${proposalId}`);
  revalidatePath(`/proposals/${proposalId}/schedule`);
  revalidatePath("/calendar");
  if (portalToken) {
    revalidatePath(`/p/${portalToken}`);
  }
}

const DATE_SELECT =
  "id, status, workspace_id, accepted_at, booking_confirmation, planned_start_date, planned_start_time, customer_id, customer_name, customer_email, customer_phone, customer_address, job_address, materials, customer_access_token, proposal_number";

async function loadTraderProposal(proposalId: string): Promise<
  | { ok: true; userId: string; proposal: DateWorkflowProposalRow }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }
  if (!(await userHasProfile(user.id))) {
    return { ok: false, error: "Please complete onboarding first." };
  }

  const { data: proposal, error } = await supabase
    .from("proposals")
    .select(DATE_SELECT)
    .eq("id", proposalId)
    .maybeSingle();

  if (error || !proposal) {
    return { ok: false, error: "Proposal not found." };
  }

  return {
    ok: true,
    userId: user.id,
    proposal: proposal as DateWorkflowProposalRow,
  };
}

export async function confirmConversationDate(
  _prev: DateWorkflowActionState,
  formData: FormData
): Promise<DateWorkflowActionState> {
  const proposalId = getString(formData, "proposalId");
  const dateIso = getString(formData, "plannedStartDateExact");
  const timeHm = normalizePlannedStartTime(
    getString(formData, "plannedStartTime")
  );
  const dateText = getString(formData, "plannedStartDateText");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }
  if (!dateIso || !timeHm) {
    return { error: "Choose a date and time before confirming." };
  }

  const loaded = await loadTraderProposal(proposalId);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const supabase = await createClient();
  const snapshot = buildDateWorkflowSnapshot({
    status: loaded.proposal.status,
    acceptedAt: loaded.proposal.accepted_at,
    bookingConfirmation: loaded.proposal.booking_confirmation,
    plannedStartDate: loaded.proposal.planned_start_date,
    plannedStartTime: loaded.proposal.planned_start_time,
  });
  const transition = applyTraderConfirmDate(snapshot.dateState);
  const alreadySameSlot =
    snapshot.dateState === "confirmed" &&
    sameDateSlot(
      {
        date: loaded.proposal.planned_start_date,
        time: loaded.proposal.planned_start_time,
      },
      { date: dateIso, time: timeHm }
    );

  const messages = await loadProposalCustomerMessages(supabase, proposalId);
  const nextStatus = nextStatusAfterDateResolved({
    proposalAccepted: snapshot.proposalAccepted,
    hasOtherUnresolvedRequests: hasOtherUnresolvedWorkRequests(messages),
  });
  const slotLabel = formatSlotLabel({
    dateIso,
    dateText,
    timeHm,
  });

  if (!alreadySameSlot) {
    const saved = await persistProposalDateSlot(supabase, loaded.proposal, {
      dateIso,
      timeHm,
      dateText:
        dateText ||
        buildScheduleDateLabel({
          dateIso,
          time: timeHm,
        }),
      nextDateState: transition.next,
      nextStatus,
      userId: loaded.userId,
      eventNote: `Date confirmed: ${slotLabel}`,
      metadata: {
        action: "trader_confirm_date",
        ask_customer_to_confirm: false,
      },
    });
    if (saved.error) {
      return { error: saved.error };
    }
  }

  await promoteBookedJobIfReady(
    supabase,
    {
      ...loaded.proposal,
      status: snapshot.proposalAccepted ? "booked" : nextStatus,
      accepted_at: loaded.proposal.accepted_at,
      booking_confirmation: "confirmed",
      planned_start_date: dateIso,
      planned_start_time: timeHm,
    },
    { userId: loaded.userId }
  );

  revalidateDatePaths(proposalId, loaded.proposal.customer_access_token);
  redirect(`/proposals/${proposalId}`);
}

export async function holdConversationDate(
  _prev: DateWorkflowActionState,
  formData: FormData
): Promise<DateWorkflowActionState> {
  const proposalId = getString(formData, "proposalId");
  const dateIso = getString(formData, "plannedStartDateExact");
  const timeHm = normalizePlannedStartTime(
    getString(formData, "plannedStartTime")
  );
  const dateText = getString(formData, "plannedStartDateText");

  if (!proposalId) {
    return { error: "Proposal not found." };
  }
  if (!dateIso || !timeHm) {
    return { error: "Choose a date and time before holding it." };
  }

  const loaded = await loadTraderProposal(proposalId);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const snapshot = buildDateWorkflowSnapshot({
    status: loaded.proposal.status,
    acceptedAt: loaded.proposal.accepted_at,
    bookingConfirmation: loaded.proposal.booking_confirmation,
    plannedStartDate: loaded.proposal.planned_start_date,
    plannedStartTime: loaded.proposal.planned_start_time,
  });

  if (snapshot.dateState === "confirmed") {
    revalidateDatePaths(proposalId, loaded.proposal.customer_access_token);
    redirect(`/proposals/${proposalId}`);
  }

  const transition = applyTraderProvisionalHold(snapshot.dateState);
  const alreadySameSlot =
    snapshot.dateState === "provisional" &&
    sameDateSlot(
      {
        date: loaded.proposal.planned_start_date,
        time: loaded.proposal.planned_start_time,
      },
      { date: dateIso, time: timeHm }
    );

  const supabase = await createClient();
  const messages = await loadProposalCustomerMessages(supabase, proposalId);
  const nextStatus = snapshot.proposalAccepted
    ? normalizeProposalStatus(loaded.proposal.status) === "booked"
      ? "booked"
      : nextStatusAfterDateResolved({
          proposalAccepted: true,
          hasOtherUnresolvedRequests: hasOtherUnresolvedWorkRequests(messages),
        })
    : nextStatusAfterDateResolved({
        proposalAccepted: false,
        hasOtherUnresolvedRequests: hasOtherUnresolvedWorkRequests(messages),
      });
  const slotLabel = formatSlotLabel({
    dateIso,
    dateText,
    timeHm,
  });

  if (!alreadySameSlot) {
    const saved = await persistProposalDateSlot(supabase, loaded.proposal, {
      dateIso,
      timeHm,
      dateText:
        dateText ||
        buildScheduleDateLabel({
          dateIso,
          time: timeHm,
        }),
      nextDateState: transition.next,
      nextStatus,
      userId: loaded.userId,
      eventNote: `Provisional hold created: ${slotLabel}`,
      metadata: {
        action: "trader_provisional_hold",
      },
    });
    if (saved.error) {
      return { error: saved.error };
    }
  }

  if (transition.notifyCustomer && !alreadySameSlot) {
    await notifyCustomerProposedDate(
      supabase,
      {
        ...loaded.proposal,
        planned_start_date: dateIso,
        planned_start_time: timeHm,
      },
      slotLabel
    );
  }

  revalidateDatePaths(proposalId, loaded.proposal.customer_access_token);
  redirect(`/proposals/${proposalId}`);
}
