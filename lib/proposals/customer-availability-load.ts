import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isProposalAcceptedStatus,
  readDateSlotState,
} from "@/lib/proposals/date-workflow";
import {
  TEMP_HOLD_ACTION,
  isTemporaryHoldExpired,
  type OccupiedWorkSlot,
  type SlotHoldKind,
} from "@/lib/proposals/slot-hold";
import {
  buildPublicAvailability,
  toOccupiedWorkSlots,
  visitsToOccupiedSlots,
  type PublicAvailabilitySlot,
} from "@/lib/proposals/customer-availability";

type HoldEventRow = {
  proposal_id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export async function loadWorkspaceOccupiedSlots(
  supabase: SupabaseClient,
  workspaceId: string,
  now: Date = new Date()
): Promise<OccupiedWorkSlot[]> {
  const { data: proposals } = await supabase
    .from("proposals")
    .select(
      "id, planned_start_date, planned_start_time, estimated_duration, booking_confirmation, status, accepted_at"
    )
    .eq("workspace_id", workspaceId)
    .not("planned_start_date", "is", null);

  const proposalIds = (proposals ?? []).map((row) => row.id as string);
  const holdByProposal = new Map<string, HoldEventRow>();

  if (proposalIds.length > 0) {
    const { data: events } = await supabase
      .from("proposal_status_events")
      .select("proposal_id, created_at, metadata")
      .eq("workspace_id", workspaceId)
      .in("proposal_id", proposalIds)
      .order("created_at", { ascending: false });

    for (const event of events ?? []) {
      const metadata = (event.metadata ?? {}) as Record<string, unknown>;
      if (metadata.action !== TEMP_HOLD_ACTION) {
        continue;
      }
      const proposalId = event.proposal_id as string;
      if (!holdByProposal.has(proposalId)) {
        holdByProposal.set(proposalId, {
          proposal_id: proposalId,
          created_at: event.created_at as string,
          metadata,
        });
      }
    }
  }

  const proposalSlots = toOccupiedWorkSlots(
    (proposals ?? []).map((row) => {
      const hold = holdByProposal.get(row.id as string);
      const holdKind: SlotHoldKind | null = hold
        ? "customer_temp"
        : row.booking_confirmation === "provisional"
          ? "trader"
          : null;
      return {
        proposalId: row.id as string,
        startDate: row.planned_start_date as string | null,
        startTime: (row.planned_start_time as string | null) ?? null,
        duration: (row.estimated_duration as string | null) ?? null,
        accepted: isProposalAcceptedStatus(
          row.status as string,
          row.accepted_at as string | null
        ),
        dateState: readDateSlotState(
          row.booking_confirmation as string | null,
          row.planned_start_date as string | null
        ),
        holdKind,
        holdCreatedAt: hold?.created_at ?? null,
      };
    }),
    now
  );

  const { data: visits } = await supabase
    .from("visits")
    .select("id, visit_date, visit_time, status")
    .eq("workspace_id", workspaceId)
    .in("status", ["scheduled", "confirmed"]);

  const visitSlots = visitsToOccupiedSlots(
    (visits ?? []).map((visit) => ({
      id: visit.id as string,
      visitDate: visit.visit_date as string | null,
      visitTime: (visit.visit_time as string | null) ?? null,
    }))
  );

  return [...proposalSlots, ...visitSlots];
}

export async function loadPublicAvailabilityForProposal(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    proposalId: string;
    estimatedDuration?: string | null;
  },
  now: Date = new Date()
): Promise<PublicAvailabilitySlot[]> {
  const occupied = await loadWorkspaceOccupiedSlots(
    supabase,
    input.workspaceId,
    now
  );
  return buildPublicAvailability({
    estimatedDuration: input.estimatedDuration,
    occupied,
    ignoreProposalId: input.proposalId,
    now,
    fromDate: now,
  });
}

export async function expireAbandonedTempHold(
  supabase: SupabaseClient,
  proposal: {
    id: string;
    workspace_id: string;
    status: string;
    accepted_at?: string | null;
    booking_confirmation?: string | null;
    planned_start_date?: string | null;
  },
  now: Date = new Date()
): Promise<boolean> {
  if (isProposalAcceptedStatus(proposal.status, proposal.accepted_at)) {
    return false;
  }
  if (readDateSlotState(proposal.booking_confirmation, proposal.planned_start_date) !== "provisional") {
    return false;
  }

  const { data: events } = await supabase
    .from("proposal_status_events")
    .select("created_at, metadata")
    .eq("proposal_id", proposal.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const hold = (events ?? []).find((event) => {
    const metadata = (event.metadata ?? {}) as Record<string, unknown>;
    return metadata.action === TEMP_HOLD_ACTION;
  });

  if (!hold || !isTemporaryHoldExpired(hold.created_at as string, now)) {
    return false;
  }

  const { error } = await supabase
    .from("proposals")
    .update({
      booking_confirmation: null,
      planned_start_date: null,
      planned_start_date_text: null,
      planned_start_time: null,
    })
    .eq("id", proposal.id)
    .is("accepted_at", null);

  return !error;
}
